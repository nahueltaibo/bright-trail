import type { SchoolGrade, SkillGrade } from '@bright-trail/shared';

/** "JK", "SK", "Kindergarten", or "Grade 3". */
export function gradeLabel(grade: SchoolGrade | SkillGrade): string {
  if (grade === 'JK' || grade === 'SK') return grade;
  if (grade === 'K') return 'Kindergarten';
  return `Grade ${grade}`;
}
