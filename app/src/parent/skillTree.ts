import {
  SKILL_GRADES,
  isReviewDue,
  type Attempt,
  type MasteryState,
  type MasteryStatus,
  type PlacementState,
  type Skill,
  type SkillGrade,
} from '@bright-trail/shared';

export const STATE_STYLES: Record<MasteryStatus, { label: string; color: string; text: string }> = {
  unknown: { label: 'Not started', color: '#E4E4E4', text: '#444' },
  assumed: { label: 'Assumed', color: '#C9DDF7', text: '#1B3A66' },
  gap: { label: 'Gap', color: '#F6C2C2', text: '#7A1414' },
  learning: { label: 'Learning', color: '#FCE3A6', text: '#6B4A00' },
  mastered: { label: 'Mastered', color: '#BFE6C4', text: '#14501E' },
  'review-due': { label: 'Review due', color: '#E2CCF5', text: '#4A1D72' },
};

/** Legend order: the path a skill takes through the loop. */
export const LEGEND_ORDER: readonly MasteryStatus[] = [
  'assumed',
  'gap',
  'learning',
  'mastered',
  'review-due',
  'unknown',
];

/** The state to show. A mastered skill whose review date has come shows as review due. */
export function displayState(mastery: MasteryState | undefined, today: string): MasteryStatus {
  if (!mastery) return 'unknown';
  return isReviewDue(mastery, today) ? 'review-due' : mastery.status;
}

export type SkillRow = { skill: Skill; state: MasteryStatus; mastery?: MasteryState };
export type GradeGroup = { grade: SkillGrade; rows: SkillRow[] };

/** Skills in bundle order, grouped by grade from K up. Empty grades are left out. */
export function groupSkillsByGrade(
  skills: readonly Skill[],
  mastery: readonly MasteryState[],
  today: string,
): GradeGroup[] {
  const bySkill = new Map(mastery.map((m) => [m.skillId, m]));
  return SKILL_GRADES.map((grade) => ({
    grade,
    rows: skills
      .filter((s) => s.grade === grade)
      .map((skill) => {
        const m = bySkill.get(skill.id);
        return { skill, state: displayState(m, today), mastery: m };
      }),
  })).filter((g) => g.rows.length > 0);
}

export type PlacementResultRow = {
  skill: Skill;
  /** What placement concluded: shown it, or found a gap. */
  passed: boolean;
  /** Placement items answered and answered right for this skill. */
  answered: number;
  correct: number;
};

/**
 * The skills placement asked about, in grade order, so a parent can spot-check them. Tallies
 * count only this placement's items, so attempts from before a progress reset are left out.
 */
export function placementResults(
  skills: readonly Skill[],
  placement: Pick<PlacementState, 'results' | 'usedItemIds'>,
  attempts: readonly Attempt[],
): PlacementResultRow[] {
  const used = new Set(placement.usedItemIds);
  // Placement shows each item once, so the latest answer to it is this placement's.
  const latest = new Map<string, Attempt>();
  for (const a of attempts)
    if (a.phase === 'placement' && used.has(a.itemId)) latest.set(a.itemId, a);
  const tally = new Map<string, { answered: number; correct: number }>();
  for (const a of latest.values()) {
    const t = tally.get(a.skillId) ?? { answered: 0, correct: 0 };
    t.answered++;
    if (a.correct) t.correct++;
    tally.set(a.skillId, t);
  }
  const passed = new Map(placement.results.map((r) => [r.skillId, r.passed]));
  return SKILL_GRADES.flatMap((grade) =>
    skills
      .filter((skill) => skill.grade === grade && passed.has(skill.id))
      .map((skill) => ({
        skill,
        passed: passed.get(skill.id)!,
        answered: tally.get(skill.id)?.answered ?? 0,
        correct: tally.get(skill.id)?.correct ?? 0,
      })),
  );
}
