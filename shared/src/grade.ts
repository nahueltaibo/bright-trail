import { z } from 'zod';

export const SCHOOL_GRADES = ['JK', 'SK', '1', '2', '3', '4', '5', '6', '7', '8'] as const;
export const SchoolGradeSchema = z.enum(SCHOOL_GRADES);
export type SchoolGrade = z.infer<typeof SchoolGradeSchema>;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function yearAndMonth(date: string | Date): [year: number, month: number] {
  // Local getters, not UTC: `new Date('2026-09-01')` is still Aug 31 in Toronto.
  if (date instanceof Date) return [date.getFullYear(), date.getMonth() + 1];
  const match = ISO_DATE.exec(date);
  if (!match) throw new Error(`Expected a YYYY-MM-DD date, got "${date}"`);
  return [Number(match[1]), Number(match[2])];
}

/**
 * Ontario school grade on `today`. A child starts Grade 1 in September of the calendar year
 * they turn 6, so only the birth year matters. Clamps to JK for younger children and 8 for older.
 */
export function deriveGrade(birthdate: string, today: string | Date): SchoolGrade {
  const [birthYear] = yearAndMonth(birthdate);
  const [year, month] = yearAndMonth(today);
  const schoolYearStart = month >= 9 ? year : year - 1;
  const grade = schoolYearStart - (birthYear + 6) + 1;
  // SCHOOL_GRADES[0] is JK (grade -1), so the index is grade + 1.
  const index = Math.min(Math.max(grade + 1, 0), SCHOOL_GRADES.length - 1);
  return SCHOOL_GRADES[index];
}
