import { z } from 'zod';

// Flat objects with nullable fields instead of unions: structured output follows them more reliably.

export const GenVisualSchema = z.strictObject({
  kind: z.enum(['emoji', 'objects', 'ten-frame']),
  emoji: z.string().nullable(),
  count: z.number().int().nullable(),
  filled: z.number().int().nullable(),
});
export type GenVisual = z.infer<typeof GenVisualSchema>;

export const CHECK_RULES = ['equals', 'nearest', 'greatest', 'least', 'true', 'none'] as const;
export type CheckRule = (typeof CHECK_RULES)[number];

export const GenCheckSchema = z.strictObject({
  rule: z.enum(CHECK_RULES),
  /** The exact answer for `equals`, the true amount for `nearest`. Empty otherwise. */
  expr: z.string(),
  /** Tap only: what each choice is worth, or for `true` a statement that holds for that choice. */
  choices: z.array(z.strictObject({ id: z.string(), expr: z.string() })),
  /** Rule `none` only: why code can't check the answer. */
  note: z.string(),
});
export type GenCheck = z.infer<typeof GenCheckSchema>;

export const GenChoiceSchema = z.strictObject({
  id: z.enum(['a', 'b', 'c', 'd']),
  kind: z.enum(['number', 'text', 'visual']),
  value: z.number().nullable(),
  text: z.string().nullable(),
  visual: GenVisualSchema.nullable(),
  /** Spoken label of a visual choice. */
  narration: z.string().nullable(),
});
export type GenChoice = z.infer<typeof GenChoiceSchema>;

export const GenItemSchema = z.strictObject({
  type: z.enum(['tap', 'keypad', 'number-line']),
  difficulty: z.number().int(),
  narration: z.string(),
  prompt: z.string(),
  why: z.string(),
  visual: GenVisualSchema.nullable(),
  choices: z.array(GenChoiceSchema),
  answerChoiceId: z.string(),
  answer: z.number().nullable(),
  min: z.number().nullable(),
  max: z.number().nullable(),
  step: z.number().nullable(),
  target: z.number().nullable(),
  check: GenCheckSchema,
});
export type GenItem = z.infer<typeof GenItemSchema>;

export const GenCardSchema = z.strictObject({
  narration: z.string(),
  text: z.string().nullable(),
  visual: GenVisualSchema.nullable(),
});

export const GeneratedContentSchema = z.strictObject({
  cards: z.array(GenCardSchema),
  items: z.array(GenItemSchema),
});
export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;

export const REVIEW_CATEGORIES = [
  'wrong-answer',
  'ambiguous',
  'factual',
  'age',
  'audio',
  'mismatch',
  'other',
] as const;

export const ContentReviewSchema = z.strictObject({
  problems: z.array(
    z.strictObject({
      /** An item id, or `story` for the nugget. */
      target: z.string(),
      severity: z.enum(['blocker', 'note']),
      category: z.enum(REVIEW_CATEGORIES),
      note: z.string(),
    }),
  ),
  notes: z.string(),
});
export type ContentReview = z.infer<typeof ContentReviewSchema>;
export type ReviewProblem = ContentReview['problems'][number];
