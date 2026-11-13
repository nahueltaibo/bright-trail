import { z } from 'zod';
import { IdSchema, NonEmptyTextSchema } from './common';

/** Ontario curriculum documents, named by subject and the year the Ministry gives them. */
export const FRAMEWORKS = [
  'ontario-math-2020',
  'ontario-kindergarten-2026',
  'ontario-language-2023',
  'ontario-science-2022',
  'ontario-social-studies-2026',
  'ontario-fsl-2013',
  'ontario-hpe-2019',
  'ontario-arts-2009',
] as const;
export const FrameworkSchema = z.enum(FRAMEWORKS);
export type Framework = z.infer<typeof FrameworkSchema>;

/** Subjects the content covers. Packs and a child's choices are per subject. */
export const SUBJECTS = [
  'math',
  'language',
  'science',
  'social-studies',
  'french',
  'health',
  'arts',
] as const;
export const SubjectSchema = z.enum(SUBJECTS);
export type Subject = z.infer<typeof SubjectSchema>;

/** Subjects with content, so the only ones a parent can pick. */
export const OFFERED_SUBJECTS = ['math'] as const satisfies readonly Subject[];

/** Topics a parent turns on for a child before the trail shows them. */
export const PARENT_OPT_INS = ['human-development'] as const;
export const ParentOptInSchema = z.enum(PARENT_OPT_INS);
export type ParentOptIn = z.infer<typeof ParentOptInSchema>;

/** Each subject's framework for Grades 1–6. Kindergarten skills use `ontario-kindergarten-2026`. */
export const SUBJECT_FRAMEWORKS: Record<Subject, Framework> = {
  math: 'ontario-math-2020',
  language: 'ontario-language-2023',
  science: 'ontario-science-2022',
  'social-studies': 'ontario-social-studies-2026',
  french: 'ontario-fsl-2013',
  health: 'ontario-hpe-2019',
  arts: 'ontario-arts-2009',
};

/** Grades the curriculum covers. JK and SK share one Kindergarten curriculum. */
export const SKILL_GRADES = ['K', '1', '2', '3', '4', '5', '6'] as const;
export const SkillGradeSchema = z.enum(SKILL_GRADES);
export type SkillGrade = z.infer<typeof SkillGradeSchema>;

/** Specific (`B2.3`) or overall (`B2`) expectation code. */
export const ExpectationCodeSchema = z.string().regex(/^[A-Z]\d+(\.\d+)?$/);

export const SkillSchema = z
  .object({
    id: IdSchema,
    subject: SubjectSchema,
    framework: FrameworkSchema,
    grade: SkillGradeSchema,
    /** Strand letter, e.g. `B` for Number in Math 2020, `A` in Kindergarten 2026. */
    strand: z.string().regex(/^[A-Z]$/),
    expectationCodes: z.array(ExpectationCodeSchema).min(1),
    title: NonEmptyTextSchema,
    /** Kid-facing, so it may be read aloud. */
    description: NonEmptyTextSchema,
    prerequisiteIds: z.array(IdSchema),
    /** Set when a parent must turn the skill on first, such as Human Development and Sexual Health. */
    parentOptIn: ParentOptInSchema.optional(),
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
    if (!kindergarten && skill.framework !== SUBJECT_FRAMEWORKS[skill.subject]) {
      ctx.addIssue({
        code: 'custom',
        path: ['framework'],
        message: `${skill.subject} skills use ${SUBJECT_FRAMEWORKS[skill.subject]}`,
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
