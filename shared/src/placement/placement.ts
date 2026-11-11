import { z } from 'zod';
import { IdSchema } from '../common';
import { gradeRank, type SkillGraph } from '../engine/graph';
import { createLearnerState, type LearnerState } from '../engine/learner';
import type { SchoolGrade } from '../grade';
import type { Item } from '../item';
import type { SkillGrade } from '../skill';

/** Hard cap on items, about 15 minutes at 30 seconds each. */
export const PLACEMENT_ITEM_BUDGET = 28;
/** Key skills sampled per grade, the ones the most other skills depend on. */
export const SKILLS_PER_GRADE = 3;
/** A skill gets up to 3 items and passes at 2 right, so a clear case takes only 2. */
export const ITEMS_PER_SKILL = 3;
export const SKILL_PASS_COUNT = 2;
/** Failed skills in one grade that send placement a grade down. */
export const STEP_DOWN_FAILED_SKILLS = 2;
/** Failed skills a grade may have and still send placement a grade up. */
export const STEP_UP_MAX_FAILED_SKILLS = 0;
/** A skill's first item is medium. Each later one is a level harder after a right answer, easier after a miss. */
export const START_DIFFICULTY = 2;

const GRADE_OUTCOMES = ['strong', 'mixed', 'weak'] as const;
export type GradeOutcome = (typeof GRADE_OUTCOMES)[number];

/** The parts of an item placement reads. */
export type PlacementItem = Pick<Item, 'id' | 'skillId' | 'difficulty'>;

/** The graph and item bank, indexed once per bundle. */
export interface PlacementContent<T extends PlacementItem = PlacementItem> {
  readonly graph: SkillGraph;
  /** In bundle order, which breaks difficulty ties. */
  readonly itemsBySkill: ReadonlyMap<string, readonly T[]>;
  readonly itemsById: ReadonlyMap<string, T>;
  /** How many skills depend on each skill, directly or through others. */
  readonly dependents: ReadonlyMap<string, number>;
  readonly topRank: number;
  /** Grade ranks whose packs exist but aren't installed. Placement waits for these instead of skipping them. */
  readonly missingRanks: ReadonlySet<number>;
}

/**
 * `missingGrades` are grades the manifest has packs for but the device doesn't. Grades with no pack
 * at all have no items, so placement skips them.
 */
export function createPlacementContent<T extends PlacementItem>(
  graph: SkillGraph,
  items: readonly T[],
  missingGrades: readonly SkillGrade[] = [],
): PlacementContent<T> {
  const itemsBySkill = new Map<string, T[]>();
  const itemsById = new Map<string, T>();
  for (const item of items) {
    if (!graph.byId.has(item.skillId)) continue;
    itemsById.set(item.id, item);
    itemsBySkill.set(item.skillId, [...(itemsBySkill.get(item.skillId) ?? []), item]);
  }

  const children = new Map<string, string[]>(graph.skills.map((s) => [s.id, []]));
  for (const skill of graph.skills) {
    for (const id of skill.prerequisiteIds) children.get(id)!.push(skill.id);
  }
  const dependents = new Map<string, number>();
  for (const skill of graph.skills) {
    const seen = new Set<string>();
    const stack = [...children.get(skill.id)!];
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      stack.push(...children.get(id)!);
    }
    dependents.set(skill.id, seen.size);
  }

  const topRank = Math.max(0, ...graph.skills.map((s) => gradeRank(s.grade)));
  const missingRanks = new Set(missingGrades.map(gradeRank));
  return { graph, itemsBySkill, itemsById, dependents, topRank, missingRanks };
}

/** Plain JSON, so the app can persist it and resume placement in a later session. */
export const PlacementStateSchema = z.object({
  childId: IdSchema,
  /** `search` walks grades, `trace` probes prerequisites of failed skills below the placed grade. */
  phase: z.enum(['search', 'trace', 'done']),
  /** The placed grade rank lies in `low..high`. `high` above the top grade means everything is known. */
  low: z.number().int().min(0),
  high: z.number().int().min(0),
  direction: z.enum(['up', 'down']).nullable(),
  /** Grade rank being sampled in `search`. */
  grade: z.number().int().min(0).nullable(),
  gradeSize: z.number().int().min(0),
  gradePassed: z.number().int().min(0),
  gradeFailed: z.number().int().min(0),
  /** Skills still to probe: the grade sample in `search`, prerequisites in `trace`. Next first. */
  queue: z.array(IdSchema),
  /** The skill being probed and the item on screen. */
  current: z
    .object({
      skillId: IdSchema,
      itemId: IdSchema,
      answered: z.number().int().min(0),
      correct: z.number().int().min(0),
    })
    .nullable(),
  /** Probed skills, in the order they were settled. */
  results: z.array(z.object({ skillId: IdSchema, passed: z.boolean() })),
  grades: z.array(z.object({ grade: z.number().int().min(0), outcome: z.enum(GRADE_OUTCOMES) })),
  /** Every item shown, so none repeats. The app can skip these in later checks too. */
  usedItemIds: z.array(IdSchema),
  itemsAnswered: z.number().int().min(0),
  /** Set when `search` ends. */
  placedRank: z.number().int().min(0).nullable(),
  /** Grade rank whose pack placement needs before it can go on. See `resumePlacement`. */
  waitingFor: z.number().int().min(0).nullable().default(null),
});
export type PlacementState = z.infer<typeof PlacementStateSchema>;

/** What placement needs next. `need-pack` asks the app to install `grade`'s packs, then call `resumePlacement`. */
export type PlacementStep<T extends PlacementItem = PlacementItem> =
  { kind: 'item'; item: T } | { kind: 'need-pack'; grade: SkillGrade } | { kind: 'done' };

export interface PlacementResult {
  /** Ready for `nextStep`. Probed skills are mastered or gap, unprobed ones below the placed grade assumed. */
  learner: LearnerState;
  /** Where teaching starts. `null` means above every grade in the graph. */
  placedGrade: SkillGrade | null;
}

function unusedItems<T extends PlacementItem>(
  state: PlacementState,
  content: PlacementContent<T>,
  skillId: string,
): T[] {
  const used = new Set(state.usedItemIds);
  return (content.itemsBySkill.get(skillId) ?? []).filter((item) => !used.has(item.id));
}

function isProbed(state: PlacementState, skillId: string): boolean {
  return state.results.some((r) => r.skillId === skillId) || state.current?.skillId === skillId;
}

function canProbe(state: PlacementState, content: PlacementContent, skillId: string): boolean {
  return (
    !isProbed(state, skillId) && unusedItems(state, content, skillId).length >= SKILL_PASS_COUNT
  );
}

function rankOf(content: PlacementContent, skillId: string): number {
  return gradeRank(content.graph.byId.get(skillId)!.grade);
}

/** Probeable now, or maybe once its missing pack is installed. */
function canProbeLater(state: PlacementState, content: PlacementContent, skillId: string): boolean {
  return content.missingRanks.has(rankOf(content, skillId))
    ? !isProbed(state, skillId)
    : canProbe(state, content, skillId);
}

/** True when the grade has skills to sample now, or may once its missing pack is installed. */
function hasSample(state: PlacementState, content: PlacementContent, rank: number): boolean {
  if (!content.missingRanks.has(rank)) return sampleGrade(state, content, rank).length > 0;
  return content.graph.skills.some((s) => gradeRank(s.grade) === rank && !isProbed(state, s.id));
}

function sampleGrade(state: PlacementState, content: PlacementContent, rank: number): string[] {
  return content.graph.skills
    .filter((s) => gradeRank(s.grade) === rank && canProbe(state, content, s.id))
    .map((s) => s.id)
    .sort((a, b) => content.dependents.get(b)! - content.dependents.get(a)!)
    .slice(0, SKILLS_PER_GRADE);
}

function enterGrade(d: PlacementState, content: PlacementContent, rank: number) {
  d.grade = rank;
  d.gradePassed = 0;
  d.gradeFailed = 0;
  if (content.missingRanks.has(rank)) {
    d.waitingFor = rank;
    d.queue = [];
    d.gradeSize = 0;
    return;
  }
  d.queue = sampleGrade(d, content, rank);
  d.gradeSize = d.queue.length;
}

/** Nearest grade in `low..high-1` past `from` with skills to sample, stepping by `step`. */
function gradeFrom(
  d: PlacementState,
  content: PlacementContent,
  from: number,
  step: 1 | -1,
): number | null {
  for (let r = from + step; r >= d.low && r < d.high; r += step) {
    if (hasSample(d, content, r)) return r;
  }
  return null;
}

/** Next grade to sample, moving the way the last outcome points. */
function nextGrade(d: PlacementState, content: PlacementContent): number | null {
  return gradeFrom(d, content, d.grade!, d.direction === 'down' ? -1 : 1);
}

/** Nearest grade to `target` with skills to sample, looking down first. */
function firstGrade(d: PlacementState, content: PlacementContent, target: number): number | null {
  const ranks = Array.from({ length: content.topRank + 1 }, (_, r) => r).sort(
    (a, b) => Math.abs(a - target) - Math.abs(b - target) || a - b,
  );
  return ranks.find((r) => hasSample(d, content, r)) ?? null;
}

function pickItem<T extends PlacementItem>(
  d: PlacementState,
  content: PlacementContent<T>,
  skillId: string,
  difficulty: number,
): T | null {
  let best: T | null = null;
  for (const item of unusedItems(d, content, skillId)) {
    if (!best || Math.abs(item.difficulty - difficulty) < Math.abs(best.difficulty - difficulty)) {
      best = item;
    }
  }
  return best;
}

function show(d: PlacementState, skillId: string, item: PlacementItem, answered = 0, correct = 0) {
  d.current = { skillId, itemId: item.id, answered, correct };
  d.usedItemIds.push(item.id);
}

/** Queues a failed skill's unprobed prerequisites below the placed grade. Front-queuing traces a chain to its root. */
function queuePrerequisites(
  d: PlacementState,
  content: PlacementContent,
  skillId: string,
  end: 'front' | 'back',
) {
  const fresh = content.graph.byId
    .get(skillId)!
    .prerequisiteIds.filter(
      (id) =>
        rankOf(content, id) < d.placedRank! &&
        !d.queue.includes(id) &&
        canProbeLater(d, content, id),
    );
  d.queue = end === 'front' ? [...fresh, ...d.queue] : [...d.queue, ...fresh];
}

function endSearch(d: PlacementState, content: PlacementContent) {
  // Without a settled grade, place where the evidence stops: above the last strong, at the last weak.
  d.placedRank = d.low === d.high || d.direction === 'up' ? d.low : d.high;
  d.phase = 'trace';
  d.grade = null;
  d.queue = [];
  for (const r of d.results) if (!r.passed) queuePrerequisites(d, content, r.skillId, 'back');
}

function settleGrade(d: PlacementState) {
  const weakAt = Math.min(STEP_DOWN_FAILED_SKILLS, d.gradeSize);
  const outcome: GradeOutcome =
    d.gradeFailed >= weakAt
      ? 'weak'
      : d.gradeFailed <= STEP_UP_MAX_FAILED_SKILLS
        ? 'strong'
        : 'mixed';
  const grade = d.grade!;
  d.grades.push({ grade, outcome });
  d.queue = [];
  if (outcome === 'strong') {
    d.low = Math.max(d.low, grade + 1);
    d.direction = 'up';
  } else if (outcome === 'weak') {
    d.high = Math.min(d.high, grade);
    d.direction = 'down';
  } else {
    d.low = grade;
    d.high = grade;
  }
}

/** Moves to the next skill to probe, or to the end, once no skill is on screen. */
function advance(d: PlacementState, content: PlacementContent) {
  while (d.phase !== 'done' && !d.current && d.waitingFor === null) {
    const affordable = PLACEMENT_ITEM_BUDGET - d.itemsAnswered >= ITEMS_PER_SKILL;
    if (d.phase === 'search') {
      const settled =
        d.gradeFailed >= Math.min(STEP_DOWN_FAILED_SKILLS, d.gradeSize) || d.queue.length === 0;
      if (settled) {
        settleGrade(d);
        const next = d.low < d.high ? nextGrade(d, content) : null;
        if (next === null || !affordable) endSearch(d, content);
        else enterGrade(d, content, next);
        continue;
      }
      if (!affordable) {
        endSearch(d, content);
        continue;
      }
    } else if (d.queue.length === 0 || !affordable) {
      d.phase = 'done';
      d.queue = [];
      continue;
    }
    const skillId = d.queue[0];
    if (content.missingRanks.has(rankOf(content, skillId))) {
      d.waitingFor = rankOf(content, skillId);
      continue;
    }
    d.queue.shift();
    // A pack installed while waiting may hold too few items for a traced skill.
    if (!canProbe(d, content, skillId)) continue;
    const item = pickItem(d, content, skillId, START_DIFFICULTY);
    if (item) show(d, skillId, item);
  }
}

/** Starts placement at the child's grade. JK and SK start at Kindergarten. */
export function startPlacement(
  childId: string,
  content: PlacementContent,
  grade: SkillGrade | SchoolGrade,
): PlacementState {
  const startRank = Math.min(gradeRank(grade), content.topRank);
  const d: PlacementState = {
    childId,
    phase: 'search',
    low: 0,
    high: content.topRank + 1,
    direction: null,
    grade: null,
    gradeSize: 0,
    gradePassed: 0,
    gradeFailed: 0,
    queue: [],
    current: null,
    results: [],
    grades: [],
    usedItemIds: [],
    itemsAnswered: 0,
    placedRank: null,
    waitingFor: null,
  };
  const first = firstGrade(d, content, startRank);
  if (first === null) {
    return { ...d, phase: 'done', placedRank: startRank };
  }
  enterGrade(d, content, first);
  advance(d, content);
  return d;
}

export function isPlacementDone(state: PlacementState): boolean {
  return state.phase === 'done';
}

/** The item to show, the pack to install, or the end. Stable until answered or resumed. */
export function nextPlacementStep<T extends PlacementItem>(
  state: PlacementState,
  content: PlacementContent<T>,
): PlacementStep<T> {
  if (state.waitingFor !== null) {
    return { kind: 'need-pack', grade: rankToGrade(state.waitingFor) as SkillGrade };
  }
  const item = nextPlacementItem(state, content);
  return item ? { kind: 'item', item } : { kind: 'done' };
}

/**
 * Goes on after a `need-pack` step, given content built with the newly installed packs. Returns the
 * state unchanged while the pack is still missing.
 */
export function resumePlacement(state: PlacementState, content: PlacementContent): PlacementState {
  const rank = state.waitingFor;
  if (rank === null || content.missingRanks.has(rank)) return state;
  const d: PlacementState = JSON.parse(JSON.stringify(state));
  d.waitingFor = null;
  if (d.phase === 'search' && d.queue.length === 0) {
    // The pack may lack items for this grade's key skills. Then move on as if it had none.
    const next =
      sampleGrade(d, content, rank).length > 0
        ? rank
        : d.grades.length === 0
          ? firstGrade(d, content, rank)
          : nextGrade(d, content);
    if (next === null) endSearch(d, content);
    else enterGrade(d, content, next);
  }
  advance(d, content);
  return d;
}

/**
 * Grades placement may sample next, for `packsFor`'s `extraGrades` to download ahead. Traced
 * prerequisites show up once search ends and their skills are queued.
 */
export function placementGradesAhead(
  state: PlacementState,
  content: PlacementContent,
): SkillGrade[] {
  const ranks = new Set<number>();
  if (state.waitingFor !== null) ranks.add(state.waitingFor);
  if (state.phase === 'search' && state.grade !== null) {
    for (const step of [1, -1] as const) {
      const r = gradeFrom(state, content, state.grade, step);
      if (r !== null) ranks.add(r);
    }
  }
  for (const id of state.queue) ranks.add(rankOf(content, id));
  return [...ranks].sort((a, b) => a - b).map((r) => rankToGrade(r) as SkillGrade);
}

/** The item to show now, or `null` when placement is done or waiting for a pack. Stable until answered. */
export function nextPlacementItem<T extends PlacementItem>(
  state: PlacementState,
  content: PlacementContent<T>,
): T | null {
  if (!state.current) return null;
  const item = content.itemsById.get(state.current.itemId);
  if (!item) throw new Error(`Item ${state.current.itemId} is not in the bundle`);
  return item;
}

/** Records the answer to the item on screen and returns the new state. */
export function answerPlacement(
  state: PlacementState,
  content: PlacementContent,
  answer: { itemId: string; correct: boolean },
): PlacementState {
  const current = state.current;
  if (!current) throw new Error('Placement is done');
  if (answer.itemId !== current.itemId) {
    throw new Error(`Expected an answer to ${current.itemId}, got ${answer.itemId}`);
  }

  const d: PlacementState = JSON.parse(JSON.stringify(state));
  d.itemsAnswered += 1;
  const answered = current.answered + 1;
  const correct = current.correct + (answer.correct ? 1 : 0);
  d.current = null;

  let passed: boolean | null = null;
  if (correct >= SKILL_PASS_COUNT) passed = true;
  else if (answered - correct > ITEMS_PER_SKILL - SKILL_PASS_COUNT) passed = false;
  else {
    const shown = content.itemsById.get(current.itemId);
    const target = Math.min(3, Math.max(1, (shown?.difficulty ?? 2) + (answer.correct ? 1 : -1)));
    const item = pickItem(d, content, current.skillId, target);
    if (item) show(d, current.skillId, item, answered, correct);
    else passed = false;
  }

  if (passed !== null) {
    d.results.push({ skillId: current.skillId, passed });
    if (d.phase === 'search') {
      if (passed) d.gradePassed += 1;
      else d.gradeFailed += 1;
    } else if (!passed) {
      queuePrerequisites(d, content, current.skillId, 'front');
    }
    advance(d, content);
  }
  return d;
}

function rankToGrade(rank: number): SkillGrade | SchoolGrade {
  return rank === 0 ? 'K' : (String(Math.min(rank, 8)) as SkillGrade | SchoolGrade);
}

/** Turns finished placement into the learner state the engine starts from. */
export function finishPlacement(
  state: PlacementState,
  content: PlacementContent,
  now: string,
): PlacementResult {
  if (state.phase !== 'done' || state.placedRank === null) {
    throw new Error('Placement is not done');
  }
  const { graph } = content;
  const learner = createLearnerState(state.childId, graph, rankToGrade(state.placedRank), now);
  const skills = learner.skills;
  for (const { skillId, passed } of state.results) {
    skills[skillId] = { ...skills[skillId], status: passed ? 'mastered' : 'gap' };
  }
  // A skill the child showed implies its prerequisites, so unknown ones become assumed.
  const stack = state.results.filter((r) => r.passed).map((r) => r.skillId);
  const seen = new Set<string>();
  while (stack.length > 0) {
    for (const id of graph.byId.get(stack.pop()!)!.prerequisiteIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      if (skills[id].status === 'unknown') skills[id] = { ...skills[id], status: 'assumed' };
      stack.push(id);
    }
  }
  const placedGrade =
    state.placedRank > content.topRank ? null : (rankToGrade(state.placedRank) as SkillGrade);
  return { learner, placedGrade };
}
