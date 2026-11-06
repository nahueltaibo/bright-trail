import { z } from 'zod';
import { IdSchema, IsoDateTimeSchema } from './common';

/** Why the item was shown. Lets the export score placement and reviews separately. */
export const ATTEMPT_PHASES = ['placement', 'check', 'review', 'probe'] as const;
export const AttemptPhaseSchema = z.enum(ATTEMPT_PHASES);
export type AttemptPhase = z.infer<typeof AttemptPhaseSchema>;

/** One answered item. Flat, so the parent export maps straight to rows. */
export const AttemptSchema = z.object({
  childId: IdSchema,
  skillId: IdSchema,
  itemId: IdSchema,
  /** Choice id for tap items, the number entered or dropped for the others. */
  answer: z.union([z.string(), z.number()]),
  correct: z.boolean(),
  timeToAnswerMs: z.number().int().min(0),
  narrationReplays: z.number().int().min(0),
  sessionId: z.string().min(1),
  phase: AttemptPhaseSchema,
  timestamp: IsoDateTimeSchema,
});
export type Attempt = z.infer<typeof AttemptSchema>;
