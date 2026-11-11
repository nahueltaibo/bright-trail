import { gradeRank } from './engine/graph';
import type { SchoolGrade } from './grade';
import type { SkillGrade, Subject } from './skill';

/** One downloadable pack covers one subject in one grade, e.g. `math-k` or `math-3`. */
export function packId(subject: Subject, grade: SkillGrade): string {
  return `${subject}-${grade.toLowerCase()}`;
}

export type PackRef = { id: string; subject: Subject; grade: SkillGrade };

/** How many grades either side of the child's grade to keep, so near gaps and stretch skills play. */
const GRADE_REACH = 1;

/**
 * Ids of the packs a child needs: each chosen subject at the child's grade and one either side,
 * plus `extraGrades` such as grades where the child has gaps. Only packs in `available`.
 */
export function packsFor(
  child: { subjects: readonly Subject[]; grade: SkillGrade | SchoolGrade },
  available: readonly PackRef[],
  extraGrades: readonly SkillGrade[] = [],
): string[] {
  const rank = gradeRank(child.grade);
  const extra = new Set(extraGrades.map(gradeRank));
  return available
    .filter((p) => child.subjects.includes(p.subject))
    .filter(
      (p) => Math.abs(gradeRank(p.grade) - rank) <= GRADE_REACH || extra.has(gradeRank(p.grade)),
    )
    .map((p) => p.id);
}
