import { z } from 'zod';
import { IdSchema, NonEmptyTextSchema } from './common';

export const FRAMEWORKS = ['ontario-math-2020', 'ontario-kindergarten-2026'] as const;
export const FrameworkSchema = z.enum(FRAMEWORKS);
export type Framework = z.infer<typeof FrameworkSchema>;

/** Grades the curriculum covers. JK and SK share one Kindergarten curriculum. */
export const SKILL_GRADES = ['K', '1', '2', '3', '4', '5', '6'] as const;
export const SkillGradeSchema = z.enum(SKILL_GRADES);
export type SkillGrade = z.infer<typeof SkillGradeSchema>;

/** Specific (`B2.3`) or overall (`B2`) expectation code. */
export const ExpectationCodeSchema = z.string().regex(/^[A-Z]\d+(\.\d+)?$/);

export const SkillSchema = z
  .object({
    id: IdSchema,
    framework: FrameworkSchema,
    grade: SkillGradeSchema,
    /** Strand letter, e.g. `B` for Number in Math 2020, `A` in Kindergarten 2026. */
    strand: z.string().regex(/^[A-Z]$/),
    expectationCodes: z.array(ExpectationCodeSchema).min(1),
    title: NonEmptyTextSchema,
    /** Kid-facing, so it may be read aloud. */
    description: NonEmptyTextSchema,
    prerequisiteIds: z.array(IdSchema),
  })
  .superRefine((skill, ctx) => {
    const kindergarten = skill.framework === 'ontario-kindergarten-2026';
    if (kindergarten !== (skill.grade === 'K')) {
      ctx.addIssue({
        code: 'custom',
        path: ['grade'],
        message: 'Kindergarten skills use grade K, and only they do',
      });
    }
    skill.expectationCodes.forEach((code, i) => {
      if (!code.startsWith(skill.strand)) {
        ctx.addIssue({
          code: 'custom',
          path: ['expectationCodes', i],
          message: `Expectation ${code} is not in strand ${skill.strand}`,
        });
      }
    });
    if (new Set(skill.prerequisiteIds).size !== skill.prerequisiteIds.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['prerequisiteIds'],
        message: 'Prerequisites repeat',
      });
    }
  });
export type Skill = z.infer<typeof SkillSchema>;
