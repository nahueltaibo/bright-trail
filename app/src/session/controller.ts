import {
  answerPlacement,
  CHECK_SIZE,
  applyEvent,
  createPlacementContent,
  createSkillGraph,
  finishPlacement,
  localClock,
  nextPlacementItem,
  nextStep,
  PROBE_SIZE,
  resumePlacement,
  REVIEW_SIZE,
  startPlacement,
  type AttemptPhase,
  type ContentBundle,
  type Item,
  type LearnerState,
  type MasteryState,
  type PlacementContent,
  type PlacementState,
  type SkillGraph,
  type StoryNugget,
} from '@bright-trail/shared';
import type { AnswerResult, FlagTarget, ItemProgress } from '../learning/types';
import { effectiveGrade } from '../parent/children';
import type { Repository, StoredPlacement } from '../storage/repository';
import { DEFAULT_LIMITS, type SessionLimits } from './constants';
import { ItemHistory } from './items';
import { countStars } from './trail';

export type EndReason =
  /** Placement stopped after this session's share of items. It continues next session. */
  | 'placement-break'
  /** The session cap ran out. */
  | 'time-up'
  /** What's left was skipped this session, e.g. a skill already taught twice. */
  | 'done-for-today'
  /** Nothing is unlocked and nothing is due. */
  | 'all-done';

/** How a check or review ended. Probes end silently, so walk-back never shows. */
export type CheckEnd = {
  check: 'check' | 'review';
  passed: boolean;
  skillId: string;
  skillTitle: string;
  /** On a miss: `next()` tells the story again. False once walk-back starts or lessons run out. */
  storyAgain: boolean;
};

/** What the screen shows. `seq` changes on every new screen, so it can key the view. */
export type SessionView =
  | {
      kind: 'item';
      seq: number;
      item: Item;
      phase: AttemptPhase;
      /** Where the item sits in its check, review, or probe. Placement has no fixed length. */
      progress?: ItemProgress;
    }
  | { kind: 'story'; seq: number; nugget: StoryNugget }
  | ({ kind: 'check-end'; seq: number } & CheckEnd)
  | { kind: 'end'; seq: number; reason: EndReason; stars: number };

export type SessionOptions = {
  repo: Repository;
  bundle: ContentBundle;
  childId: string;
  sessionId: string;
  /** Injected so tests control time. */
  now?: () => Date;
  limits?: Partial<SessionLimits>;
};

type Unseq<T> = T extends unknown ? Omit<T, 'seq'> : never;

type Step = { kind: 'placement' } | { kind: 'check' | 'review' | 'probe'; skillId: string };

type Content = {
  graph: SkillGraph;
  placement: PlacementContent<Item>;
  itemsBySkill: ReadonlyMap<string, readonly Item[]>;
  nuggetBySkill: ReadonlyMap<string, StoryNugget>;
  titleBySkill: ReadonlyMap<string, string>;
};

const contentCache = new WeakMap<ContentBundle, Content>();

function indexContent(bundle: ContentBundle): Content {
  let content = contentCache.get(bundle);
  if (!content) {
    const graph = createSkillGraph(bundle.skills);
    const placement = createPlacementContent(graph, bundle.items);
    content = {
      graph,
      placement,
      itemsBySkill: placement.itemsBySkill,
      nuggetBySkill: new Map(bundle.nuggets.map((n) => [n.skillId, n])),
      titleBySkill: new Map(bundle.skills.map((s) => [s.id, s.title])),
    };
    contentCache.set(bundle, content);
  }
  return content;
}

/**
 * One kid session: placement until it's finished, then the engine's loop of reviews, probes,
 * lessons, and checks. Every answer is logged and its effect saved before the next screen, so
 * quitting at any point loses nothing. Calls are queued, so a fast double tap can't interleave.
 */
export class Session {
  private view!: SessionView;
  private seq = 0;
  private step: Step | null = null;
  private answered = false;
  /** Set by the answer that ends a check or review, shown by the next `next()`. */
  private ended: CheckEnd | null = null;
  private placementItems = 0;
  private readonly lessons = new Map<string, number>();
  /** Skills passed over for the rest of this session. */
  private readonly skip = new Set<string>();
  private queue: Promise<unknown> = Promise.resolve();
  private readonly startedAt: number;
  private readonly limits: SessionLimits;

  private constructor(
    private readonly options: SessionOptions,
    private readonly content: Content,
    private readonly history: ItemHistory,
    private placement: StoredPlacement | null,
    private learner: LearnerState | null,
    private readonly now: () => Date,
  ) {
    this.startedAt = now().getTime();
    this.limits = { ...DEFAULT_LIMITS, ...options.limits };
  }

  /** Loads the child, starts or resumes placement if needed, and picks the first screen. */
  static async start(options: SessionOptions): Promise<Session> {
    const { repo, bundle, childId } = options;
    const now = options.now ?? (() => new Date());
    const content = indexContent(bundle);
    const child = await repo.children.get(childId);
    if (!child) throw new Error(`No child with id ${childId}`);

    let placement = await repo.placement.get(childId);
    if (placement && !placement.finishedAt && !fitsContent(placement.state, content.placement)) {
      placement = null;
    }
    if (placement && !placement.finishedAt && placement.state.waitingFor !== null) {
      // The bundle holds every pack, so placement that waited for one can go on.
      placement = { ...placement, state: resumePlacement(placement.state, content.placement) };
      await repo.placement.save(childId, placement);
    }
    let learner: LearnerState | null = null;
    if (placement?.finishedAt) {
      learner = await loadLearner(repo, childId);
    } else if (!placement) {
      const grade = effectiveGrade(child, localClock(now()).today);
      const state = startPlacement(childId, content.placement, grade);
      placement = { state, placedGrade: null, finishedAt: null };
      await repo.placement.save(childId, placement);
    }

    const attempts = await repo.attempts.listForChild(childId);
    const history = new ItemHistory([
      ...(placement?.state.usedItemIds ?? []),
      ...attempts.map((a) => a.itemId),
    ]);
    const session = new Session(options, content, history, placement, learner, now);
    await session.advance();
    return session;
  }

  get current(): SessionView {
    return this.view;
  }

  /** Logs the answer to the item on screen and saves its effect. Ignores a second answer. */
  answer(result: AnswerResult): Promise<SessionView> {
    return this.enqueue(async () => {
      const view = this.view;
      if (view.kind !== 'item' || this.answered || result.itemId !== view.item.id) return view;
      this.answered = true;
      const { repo, childId, sessionId } = this.options;
      const clock = localClock(this.now());

      await repo.attempts.add({
        childId,
        skillId: view.item.skillId,
        itemId: view.item.id,
        answer: result.answer,
        correct: result.correct,
        timeToAnswerMs: result.msToAnswer,
        narrationReplays: result.replays,
        sessionId,
        phase: view.phase,
        timestamp: clock.now,
      });

      if (view.phase === 'placement') {
        const state = answerPlacement(this.placement!.state, this.content.placement, {
          itemId: view.item.id,
          correct: result.correct,
        });
        this.placementItems++;
        this.placement = { ...this.placement!, state };
        await repo.placement.save(childId, this.placement);
      } else {
        const before = this.learner!;
        this.learner = applyEvent(
          before,
          this.content.graph,
          {
            type: 'answered',
            skillId: view.item.skillId,
            phase: view.phase,
            correct: result.correct,
          },
          clock,
        );
        await saveLearner(repo, before, this.learner);
        this.ended = this.checkEnd(view.phase, view.item.skillId);
      }
      return view;
    });
  }

  /** Moves on after an answered item's feedback, or from the check-end screen. */
  next(): Promise<SessionView> {
    return this.enqueue(async () => {
      const view = this.view;
      if (view.kind === 'item' && this.answered) {
        if (this.ended) {
          this.step = null;
          this.show({ kind: 'check-end', ...this.ended });
          this.ended = null;
        } else await this.advance();
      } else if (view.kind === 'check-end') {
        if (view.storyAgain && !this.timeIsUp()) await this.teach(view.skillId);
        else await this.advance();
      }
      return this.view;
    });
  }

  /** The child finished the story, so the check starts. */
  finishStory(): Promise<SessionView> {
    return this.enqueue(async () => {
      if (this.view.kind !== 'story') return this.view;
      if (this.timeIsUp()) this.end('time-up');
      else this.showItem('check', this.view.nugget.skillId);
      return this.view;
    });
  }

  /** Saves a "This looks wrong" tap with the bundle version it was raised on. */
  flag(target: FlagTarget): Promise<void> {
    return this.enqueue(async () => {
      await this.options.repo.flags.add({
        childId: this.options.childId,
        ...target,
        bundleVersion: this.options.bundle.version,
        createdAt: localClock(this.now()).now,
      });
    });
  }

  private enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.queue.then(task);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private show(view: Unseq<SessionView>) {
    this.view = { ...view, seq: ++this.seq } as SessionView;
    this.answered = false;
    if (this.view.kind === 'item') this.history.see(this.view.item.id);
  }

  private end(reason: EndReason) {
    this.step = null;
    const stars = this.learner ? countStars(Object.values(this.learner.skills)) : 0;
    this.show({ kind: 'end', reason, stars });
  }

  /** Picks the next screen. Runs at item boundaries only, so the cap never cuts an item short. */
  private async advance(): Promise<void> {
    if (this.timeIsUp()) return this.end('time-up');

    if (this.placement && !this.placement.finishedAt) {
      if (this.placement.state.phase !== 'done') {
        if (this.placementItems >= this.limits.placementItemsPerSession) {
          return this.end('placement-break');
        }
        const item = nextPlacementItem(this.placement.state, this.content.placement)!;
        this.step = { kind: 'placement' };
        return this.show({ kind: 'item', item, phase: 'placement' });
      }
      await this.finishPlacement();
    }

    const learner = this.learner!;
    const today = localClock(this.now()).today;

    // A review, probe, or check runs to its last item before the engine picks again.
    const step = this.step;
    if (
      step &&
      step.kind !== 'placement' &&
      (learner.skills[step.skillId]?.checkAnswered ?? 0) > 0
    ) {
      return this.showItem(step.kind, step.skillId);
    }
    this.step = null;

    for (;;) {
      const next = nextStep(learner, this.content.graph, today, { skip: this.skip });
      if (next.kind === 'done') {
        const skipped = nextStep(learner, this.content.graph, today).kind !== 'done';
        return this.end(skipped ? 'done-for-today' : 'all-done');
      }
      if (!this.content.itemsBySkill.get(next.skillId)?.length) {
        this.skip.add(next.skillId);
        continue;
      }
      if (next.kind !== 'lesson') {
        this.step = { kind: next.kind, skillId: next.skillId };
        return this.showItem(next.kind, next.skillId);
      }

      if (!this.canTeach(next.skillId)) {
        this.skip.add(next.skillId);
        continue;
      }
      return this.teach(next.skillId);
    }
  }

  private canTeach(skillId: string): boolean {
    return (this.lessons.get(skillId) ?? 0) < this.limits.lessonsPerSkill;
  }

  /** Starts a lesson: the story, then its check. */
  private async teach(skillId: string): Promise<void> {
    const learner = this.learner!;
    this.lessons.set(skillId, (this.lessons.get(skillId) ?? 0) + 1);
    this.learner = applyEvent(
      learner,
      this.content.graph,
      { type: 'lesson-started', skillId },
      localClock(this.now()),
    );
    await saveLearner(this.options.repo, learner, this.learner);
    this.step = { kind: 'check', skillId };
    const nugget = this.content.nuggetBySkill.get(skillId);
    // Without a nugget the check still runs, so the skill can't stall the trail.
    if (nugget) return this.show({ kind: 'story', nugget });
    return this.showItem('check', skillId);
  }

  /** How the answer just saved ended a check or review, or null if it didn't end one. */
  private checkEnd(phase: AttemptPhase, skillId: string): CheckEnd | null {
    const mastery = this.learner!.skills[skillId];
    if ((phase !== 'check' && phase !== 'review') || !mastery || mastery.checkAnswered > 0) {
      return null;
    }
    const passed = mastery.status === 'mastered';
    return {
      check: phase,
      passed,
      skillId,
      skillTitle: this.content.titleBySkill.get(skillId) ?? '',
      storyAgain: mastery.status === 'learning' && this.canTeach(skillId),
    };
  }

  private timeIsUp(): boolean {
    return this.now().getTime() - this.startedAt >= this.limits.capMs;
  }

  private showItem(phase: 'check' | 'review' | 'probe', skillId: string) {
    const item = this.history.pick(this.content.itemsBySkill.get(skillId) ?? [])!;
    const progress = {
      current: this.learner?.skills[skillId]?.checkAnswered ?? 0,
      total: { check: CHECK_SIZE, review: REVIEW_SIZE, probe: PROBE_SIZE }[phase],
    };
    this.show({ kind: 'item', item, phase, progress });
  }

  private async finishPlacement() {
    const { repo, childId } = this.options;
    const clock = localClock(this.now());
    const { learner, placedGrade } = finishPlacement(
      this.placement!.state,
      this.content.placement,
      clock.now,
    );
    // Mastery first: if the app dies in between, placement finishes again on the next start.
    await saveLearner(repo, null, learner);
    this.placement = { ...this.placement!, placedGrade, finishedAt: clock.now };
    await repo.placement.save(childId, this.placement);
    this.learner = learner;
  }
}

/** False when unfinished placement points at skills or items a newer bundle dropped. */
function fitsContent(state: PlacementState, content: PlacementContent<Item>): boolean {
  const { byId } = content.graph;
  return (
    (!state.current || content.itemsById.has(state.current.itemId)) &&
    state.queue.every((id) => byId.has(id)) &&
    state.results.every((r) => byId.has(r.skillId))
  );
}

async function loadLearner(repo: Repository, childId: string): Promise<LearnerState> {
  const rows = await repo.mastery.listForChild(childId);
  return {
    childId,
    skills: Object.fromEntries(rows.map((m) => [m.skillId, m])),
    walkBack: (await repo.walkBack.get(childId)) ?? { probes: [], targets: [] },
  };
}

/** Saves the mastery rows and walk-back that changed. The engine copies only what it changes. */
async function saveLearner(repo: Repository, before: LearnerState | null, after: LearnerState) {
  const changed: MasteryState[] = Object.values(after.skills).filter(
    (m) => before?.skills[m.skillId] !== m,
  );
  for (const m of changed) await repo.mastery.save(m);
  if (JSON.stringify(before?.walkBack) !== JSON.stringify(after.walkBack)) {
    await repo.walkBack.save(after.childId, after.walkBack);
  }
}
