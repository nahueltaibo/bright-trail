import { z } from 'zod';
import { IdSchema } from '../common';
import type { SchoolGrade } from '../grade';
import {
  CHECK_PASS_COUNT,
  CHECK_SIZE,
  MasteryStateSchema,
  REVIEW_SIZE,
  type MasteryState,
  type MasteryStatus,
} from '../mastery';
import type { SkillGrade } from '../skill';
import { addDays, type Clock } from './dates';
import { gradeRank, type SkillGraph } from './graph';

/** A review passes only with every item right. */
export const REVIEW_PASS_COUNT = REVIEW_SIZE;
/** A probe of an assumed skill is scored like a review: 3 items, all right. */
export const PROBE_SIZE = 3;
export const PROBE_PASS_COUNT = 3;
/** The second failed check marks a gap and starts walk-back. */
export const FAILED_CHECKS_BEFORE_WALK_BACK = 2;
/** Days from a pass to the next review: 2 after the check, then 7 after the first review. */
export const REVIEW_INTERVAL_DAYS = [2, 7] as const;

/** Statuses that satisfy the unlock rule. A due review is still mastered. */
const SATISFIES_PREREQUISITE: readonly MasteryStatus[] = ['mastered', 'review-due', 'assumed'];

export const WalkBackSchema = z.object({
  /** Assumed prerequisites still to probe, next first. */
  probes: z.array(IdSchema),
  /** Gaps the walk-back found, taught before any other lesson. */
  targets: z.array(IdSchema),
});
export type WalkBack = z.infer<typeof WalkBackSchema>;

/** Everything the engine knows about one child. The app persists it between sessions. */
export const LearnerStateSchema = z.object({
  childId: IdSchema,
  /** Keyed by skill id. A missing skill counts as unknown. */
  skills: z.record(IdSchema, MasteryStateSchema),
  walkBack: WalkBackSchema,
});
export type LearnerState = z.infer<typeof LearnerStateSchema>;

export type LearnerEvent =
  /** The story nugget was shown, so a check can follow. */
  | { type: 'lesson-started'; skillId: string }
  | { type: 'answered'; skillId: string; phase: 'check' | 'review' | 'probe'; correct: boolean };

function freshMastery(
  childId: string,
  skillId: string,
  status: MasteryStatus,
  now: string,
): MasteryState {
  return {
    childId,
    skillId,
    status,
    checkAnswered: 0,
    checkCorrect: 0,
    failedChecks: 0,
    reviewsPassed: 0,
    nextReviewOn: null,
    updatedAt: now,
  };
}

/**
 * Starts a child with no history. Skills below `startingGrade` are assumed, the rest unknown.
 * Placement refines this.
 */
export function createLearnerState(
  childId: string,
  graph: SkillGraph,
  startingGrade: SkillGrade | SchoolGrade,
  now: string,
): LearnerState {
  const start = gradeRank(startingGrade);
  const skills: Record<string, MasteryState> = {};
  for (const skill of graph.skills) {
    const status = gradeRank(skill.grade) < start ? 'assumed' : 'unknown';
    skills[skill.id] = freshMastery(childId, skill.id, status, now);
  }
  return { childId, skills, walkBack: { probes: [], targets: [] } };
}

export function statusOf(state: LearnerState, skillId: string): MasteryStatus {
  return state.skills[skillId]?.status ?? 'unknown';
}

/** The unlock rule: every prerequisite is mastered or assumed. */
export function isUnlocked(state: LearnerState, graph: SkillGraph, skillId: string): boolean {
  const skill = graph.byId.get(skillId);
  if (!skill) throw new Error(`Unknown skill ${skillId}`);
  return skill.prerequisiteIds.every((id) => SATISFIES_PREREQUISITE.includes(statusOf(state, id)));
}

export function isReviewDue(mastery: MasteryState, today: string): boolean {
  return (
    (mastery.status === 'mastered' || mastery.status === 'review-due') &&
    mastery.nextReviewOn !== null &&
    mastery.nextReviewOn <= today
  );
}

/** Flips mastered skills whose review date has come to `review-due`, for display. */
export function markDueReviews(state: LearnerState, clock: Clock): LearnerState {
  const skills = { ...state.skills };
  for (const [id, mastery] of Object.entries(skills)) {
    if (mastery.status === 'mastered' && isReviewDue(mastery, clock.today)) {
      skills[id] = { ...mastery, status: 'review-due', updatedAt: clock.now };
    }
  }
  return { ...state, skills };
}

/** Accumulates changes to one state without mutating the input. */
class Draft {
  readonly skills: Record<string, MasteryState>;
  probes: string[];
  targets: string[];

  constructor(
    private readonly state: LearnerState,
    private readonly graph: SkillGraph,
    private readonly clock: Clock,
  ) {
    this.skills = { ...state.skills };
    this.probes = [...state.walkBack.probes];
    this.targets = [...state.walkBack.targets];
  }

  get(skillId: string): MasteryState {
    if (!this.graph.byId.has(skillId)) throw new Error(`Unknown skill ${skillId}`);
    return (
      this.skills[skillId] ?? freshMastery(this.state.childId, skillId, 'unknown', this.clock.now)
    );
  }

  set(skillId: string, changes: Partial<MasteryState>) {
    this.skills[skillId] = { ...this.get(skillId), ...changes, updatedAt: this.clock.now };
  }

  /** Marks a gap and queues its assumed prerequisites to probe ahead of older probes. */
  walkBackFrom(skillId: string) {
    if (!this.targets.includes(skillId)) this.targets.push(skillId);
    const next = this.graph.byId
      .get(skillId)!
      .prerequisiteIds.filter((id) => this.get(id).status === 'assumed');
    this.probes = [...next, ...this.probes.filter((id) => !next.includes(id))];
  }

  /** Confirms assumed prerequisites as mastered, following assumed ones down the graph. */
  confirmPrerequisites(skillId: string) {
    for (const id of this.graph.byId.get(skillId)!.prerequisiteIds) {
      if (this.get(id).status !== 'assumed') continue;
      this.set(id, { status: 'mastered', checkAnswered: 0, checkCorrect: 0 });
      this.confirmPrerequisites(id);
    }
  }

  finish(): LearnerState {
    const status = (id: string) => this.skills[id]?.status ?? 'unknown';
    return {
      childId: this.state.childId,
      skills: this.skills,
      walkBack: {
        probes: this.probes.filter((id) => status(id) === 'assumed'),
        targets: this.targets.filter((id) => ['gap', 'learning'].includes(status(id))),
      },
    };
  }
}

const RESET_PROGRESS = { checkAnswered: 0, checkCorrect: 0 } as const;

/** Applies one event and returns the new state. Throws on an event the current status forbids. */
export function applyEvent(
  state: LearnerState,
  graph: SkillGraph,
  event: LearnerEvent,
  clock: Clock,
): LearnerState {
  const draft = new Draft(state, graph, clock);
  const mastery = draft.get(event.skillId);
  const fail = (why: string): never => {
    throw new Error(`Cannot ${event.type} ${event.skillId}: ${why}`);
  };

  if (event.type === 'lesson-started') {
    if (!['unknown', 'gap', 'learning'].includes(mastery.status)) fail(`it is ${mastery.status}`);
    if (!isUnlocked(state, graph, event.skillId)) fail('a prerequisite is not mastered');
    // A new round of teaching gets two fresh tries; a reteach keeps the first failure.
    const failedChecks = mastery.status === 'learning' ? mastery.failedChecks : 0;
    draft.set(event.skillId, { status: 'learning', failedChecks, ...RESET_PROGRESS });
    return draft.finish();
  }

  const size = { check: CHECK_SIZE, review: REVIEW_SIZE, probe: PROBE_SIZE }[event.phase];
  const allowed = {
    check: mastery.status === 'learning',
    review: mastery.nextReviewOn !== null && ['mastered', 'review-due'].includes(mastery.status),
    probe: mastery.status === 'assumed',
  }[event.phase];
  if (!allowed) fail(`no ${event.phase} runs while it is ${mastery.status}`);

  const answered = mastery.checkAnswered + 1;
  const correct = mastery.checkCorrect + (event.correct ? 1 : 0);
  if (answered < size) {
    draft.set(event.skillId, { checkAnswered: answered, checkCorrect: correct });
    return draft.finish();
  }

  if (event.phase === 'check') {
    if (correct >= CHECK_PASS_COUNT) {
      draft.set(event.skillId, {
        status: 'mastered',
        failedChecks: 0,
        reviewsPassed: 0,
        nextReviewOn: addDays(clock.today, REVIEW_INTERVAL_DAYS[0]),
        ...RESET_PROGRESS,
      });
      draft.confirmPrerequisites(event.skillId);
    } else {
      const failedChecks = mastery.failedChecks + 1;
      const walkBack = failedChecks >= FAILED_CHECKS_BEFORE_WALK_BACK;
      draft.set(event.skillId, {
        status: walkBack ? 'gap' : 'learning',
        failedChecks,
        ...RESET_PROGRESS,
      });
      if (walkBack) draft.walkBackFrom(event.skillId);
    }
  } else if (event.phase === 'review') {
    if (correct >= REVIEW_PASS_COUNT) {
      const reviewsPassed = mastery.reviewsPassed + 1;
      const more = reviewsPassed < REVIEW_INTERVAL_DAYS.length;
      draft.set(event.skillId, {
        status: 'mastered',
        reviewsPassed,
        nextReviewOn: more ? addDays(clock.today, REVIEW_INTERVAL_DAYS[reviewsPassed]) : null,
        ...RESET_PROGRESS,
      });
    } else {
      draft.set(event.skillId, {
        status: 'learning',
        failedChecks: 0,
        reviewsPassed: 0,
        nextReviewOn: null,
        ...RESET_PROGRESS,
      });
    }
  } else if (correct >= PROBE_PASS_COUNT) {
    draft.set(event.skillId, { status: 'mastered', ...RESET_PROGRESS });
  } else {
    draft.set(event.skillId, { status: 'gap', failedChecks: 0, ...RESET_PROGRESS });
    draft.walkBackFrom(event.skillId);
  }
  return draft.finish();
}
