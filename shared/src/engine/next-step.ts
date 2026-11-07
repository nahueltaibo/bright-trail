import { gradeRank, type GraphSkill, type SkillGraph } from './graph';
import { isReviewDue, isUnlocked, statusOf, type LearnerState } from './learner';

export type NextStep =
  /** Run a review of `REVIEW_SIZE` items, or finish one in progress. */
  | { kind: 'review'; skillId: string }
  /** Probe an assumed prerequisite during walk-back with `PROBE_SIZE` items. */
  | { kind: 'probe'; skillId: string }
  /** Show the story nugget, send `lesson-started`, then run the check. */
  | { kind: 'lesson'; skillId: string }
  /** Finish a check already in progress, without the nugget again. */
  | { kind: 'check'; skillId: string }
  /** Nothing is unlocked and nothing is due. */
  | { kind: 'done' };

export type NextStepOptions = {
  /** Skills to pass over this time, e.g. ones the session already taught enough. */
  skip?: ReadonlySet<string>;
};

/**
 * Picks what the session does next: due reviews, then walk-back probes, then a lesson.
 * Lessons go to walk-back targets first, then skills already in learning, then the lowest grade.
 */
export function nextStep(
  state: LearnerState,
  graph: SkillGraph,
  today: string,
  { skip }: NextStepOptions = {},
): NextStep {
  const allowed = (id: string) => !skip?.has(id);
  const order = new Map(graph.skills.map((s, i) => [s.id, i]));
  const byGradeThenOrder = (a: GraphSkill, b: GraphSkill) =>
    gradeRank(a.grade) - gradeRank(b.grade) || order.get(a.id)! - order.get(b.id)!;

  const reviews = graph.skills
    .map((skill) => ({ skill, mastery: state.skills[skill.id] }))
    .filter(({ skill, mastery }) => mastery && isReviewDue(mastery, today) && allowed(skill.id))
    .sort(
      (a, b) =>
        Number(b.mastery.checkAnswered > 0) - Number(a.mastery.checkAnswered > 0) ||
        a.mastery.nextReviewOn!.localeCompare(b.mastery.nextReviewOn!) ||
        byGradeThenOrder(a.skill, b.skill),
    );
  if (reviews.length > 0) return { kind: 'review', skillId: reviews[0].skill.id };

  const probe = state.walkBack.probes.find(
    (id) => statusOf(state, id) === 'assumed' && allowed(id),
  );
  if (probe) return { kind: 'probe', skillId: probe };

  const rank = (skill: GraphSkill) =>
    state.walkBack.targets.includes(skill.id)
      ? 0
      : statusOf(state, skill.id) === 'learning'
        ? 1
        : 2;
  const lessons = graph.skills
    .filter((skill) => ['unknown', 'gap', 'learning'].includes(statusOf(state, skill.id)))
    .filter((skill) => allowed(skill.id) && isUnlocked(state, graph, skill.id))
    .sort((a, b) => rank(a) - rank(b) || byGradeThenOrder(a, b));
  if (lessons.length === 0) return { kind: 'done' };

  const skillId = lessons[0].id;
  const mastery = state.skills[skillId];
  const inCheck = mastery?.status === 'learning' && mastery.checkAnswered > 0;
  return { kind: inCheck ? 'check' : 'lesson', skillId };
}
