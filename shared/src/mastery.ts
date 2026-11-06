import { z } from 'zod';
import { IdSchema, IsoDateSchema, IsoDateTimeSchema } from './common';

/** A check passes with 4 of 5 right. */
export const CHECK_SIZE = 5;
export const CHECK_PASS_COUNT = 4;
/** A review passes only with all 3 right. */
export const REVIEW_SIZE = 3;

export const MASTERY_STATUSES = [
  'unknown',
  'assumed',
  'gap',
  'learning',
  'mastered',
  'review-due',
] as const;
export const MasteryStatusSchema = z.enum(MASTERY_STATUSES);
export type MasteryStatus = z.infer<typeof MasteryStatusSchema>;

/** One row per child per skill. */
export const MasteryStateSchema = z
  .object({
    childId: IdSchema,
    skillId: IdSchema,
    status: MasteryStatusSchema,
    /** Items answered and answered right in the check or review in progress. */
    checkAnswered: z.number().int().min(0).max(CHECK_SIZE),
    checkCorrect: z.number().int().min(0).max(CHECK_SIZE),
    /** Two failed checks trigger walk-back. */
    failedChecks: z.number().int().min(0),
    /** Picks the next interval: 2 days after mastery, then 1 week. */
    reviewsPassed: z.number().int().min(0),
    /** Local calendar date, since sessions are daily. */
    nextReviewOn: IsoDateSchema.nullable(),
    updatedAt: IsoDateTimeSchema,
  })
  .refine((m) => m.checkCorrect <= m.checkAnswered, {
    path: ['checkCorrect'],
    message: 'checkCorrect cannot exceed checkAnswered',
  });
export type MasteryState = z.infer<typeof MasteryStateSchema>;
