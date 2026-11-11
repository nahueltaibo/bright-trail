import { z } from 'zod';
import { IdSchema, IsoDateSchema, NonEmptyTextSchema } from './common';
import { SchoolGradeSchema } from './grade';
import { SubjectSchema } from './skill';

export const ChildProfileSchema = z.object({
  id: IdSchema,
  firstName: NonEmptyTextSchema,
  birthdate: IsoDateSchema,
  /** Set by a parent when the derived grade is wrong. */
  gradeOverride: SchoolGradeSchema.optional(),
  /** Avatar key from the app's fixed set, so no typing or reading is needed to pick it. */
  avatar: z.string().min(1),
  /** When true, narration starts off and the child reads on their own. */
  readingMode: z.boolean(),
  /** When true, kid screens draw text in Lexend with wider letter spacing. */
  dyslexicFont: z.boolean(),
  /** Subjects the parent picked. The app downloads and teaches only these. */
  subjects: z
    .array(SubjectSchema)
    .min(1)
    .refine((list) => new Set(list).size === list.length, 'Subjects repeat'),
});
export type ChildProfile = z.infer<typeof ChildProfileSchema>;
