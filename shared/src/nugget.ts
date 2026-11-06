import { z } from 'zod';
import { IdSchema, NonEmptyTextSchema } from './common';
import { VisualSchema } from './visual';

export const StoryCardSchema = z.object({
  /** Read aloud by device text-to-speech. */
  narration: NonEmptyTextSchema,
  text: NonEmptyTextSchema.optional(),
  visual: VisualSchema.optional(),
});
export type StoryCard = z.infer<typeof StoryCardSchema>;

export const StoryNuggetSchema = z.object({
  id: IdSchema,
  skillId: IdSchema,
  cards: z.array(StoryCardSchema).min(5).max(8),
});
export type StoryNugget = z.infer<typeof StoryNuggetSchema>;
