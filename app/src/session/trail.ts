import {
  createSkillGraph,
  gradeRank,
  isReviewDue,
  isUnlocked,
  nextStep,
  type GraphSkill,
  type LearnerState,
  type MasteryState,
  type Skill,
} from '@bright-trail/shared';

/** One star per mastered skill, a due review included. Placement-proven skills count too. */
export function countStars(mastery: Iterable<Pick<MasteryState, 'status'>>): number {
  let stars = 0;
  for (const m of mastery) if (m.status === 'mastered' || m.status === 'review-due') stars++;
  return stars;
}

export type StopState = 'mastered' | 'review' | 'next' | 'ahead' | 'locked';
export type TrailStop = { title?: string; state: StopState };
export type Trail = {
  /** `new` before placement finishes, `review` when a review runs before the next lesson. */
  mode: 'new' | 'returning' | 'review';
  /** From the oldest star shown to the first locked skill. */
  stops: TrailStop[];
};

/** Stars kept on the map. Older ones still count in the star pill. */
const DONE_SHOWN = 3;
const AHEAD_SHOWN = 1;

const NEW_TRAIL: Trail = {
  mode: 'new',
  stops: [
    { title: 'Start here', state: 'next' },
    { state: 'ahead' },
    { state: 'ahead' },
    { state: 'ahead' },
    { state: 'locked' },
  ],
};

/**
 * The child's trail: the last few stars, the next skill the engine picks, one skill after it,
 * and the first skill still locked.
 */
export function buildTrail(
  skills: readonly Pick<Skill, 'id' | 'grade' | 'prerequisiteIds' | 'title'>[],
  mastery: readonly MasteryState[],
  placed: boolean,
  today: string,
): Trail {
  if (!placed) return NEW_TRAIL;

  const graph = createSkillGraph(skills);
  const title = new Map(skills.map((s) => [s.id, s.title]));
  const state: LearnerState = {
    childId: mastery[0]?.childId ?? '',
    skills: Object.fromEntries(mastery.map((m) => [m.skillId, m])),
    walkBack: { probes: [], targets: [] },
  };
  const status = (id: string) => state.skills[id]?.status ?? 'unknown';
  const order = new Map(skills.map((s, i) => [s.id, i]));
  const byGrade = (a: GraphSkill, b: GraphSkill) =>
    gradeRank(a.grade) - gradeRank(b.grade) || order.get(a.id)! - order.get(b.id)!;

  const due = mastery.filter((m) => isReviewDue(m, today));
  const done = mastery
    .filter((m) => m.status === 'mastered' || m.status === 'review-due')
    .sort(
      (a, b) =>
        a.updatedAt.localeCompare(b.updatedAt) || order.get(a.skillId)! - order.get(b.skillId)!,
    );
  // A due review stays on the map even when newer stars push it out.
  const shown = done.slice(-DONE_SHOWN);
  for (const m of due) if (!shown.includes(m)) shown.unshift(m);
  shown.sort((a, b) => done.indexOf(a) - done.indexOf(b));

  const stops: TrailStop[] = shown.map((m) => ({
    title: title.get(m.skillId),
    state: isReviewDue(m, today) ? 'review' : 'mastered',
  }));

  const step = nextStep(state, graph, today, { skip: new Set(due.map((m) => m.skillId)) });
  const nextId = step.kind === 'done' || step.kind === 'review' ? null : step.skillId;
  if (nextId) stops.push({ title: title.get(nextId), state: 'next' });

  const open = (s: GraphSkill) =>
    ['unknown', 'gap', 'learning'].includes(status(s.id)) && s.id !== nextId;
  const ahead = graph.skills
    .filter((s) => open(s) && isUnlocked(state, graph, s.id))
    .sort(byGrade)
    .slice(0, AHEAD_SHOWN);
  for (const s of ahead) stops.push({ title: title.get(s.id), state: 'ahead' });

  const locked = graph.skills
    .filter((s) => open(s) && !isUnlocked(state, graph, s.id))
    .sort(byGrade);
  if (locked.length > 0) stops.push({ title: title.get(locked[0].id), state: 'locked' });

  return { mode: due.length > 0 ? 'review' : 'returning', stops };
}
