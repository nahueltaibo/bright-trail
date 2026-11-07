import { FRACTION_SHAPES } from '@bright-trail/shared';
import { z } from 'zod';

// Flat objects with nullable fields instead of unions: structured output follows them more reliably.

const basicVisual = {
  kind: z.enum(['emoji', 'objects', 'ten-frame']),
  emoji: z.string().nullable(),
  count: z.number().int().nullable(),
  filled: z.number().int().nullable(),
};

const fractionFields = {
  shape: z.enum(FRACTION_SHAPES).nullable(),
  parts: z.number().int().nullable(),
  shaded: z.number().int().nullable(),
  wholes: z.number().int().nullable(),
  label: z.string().nullable(),
};

/** Pictures for skills without fraction pictures. Changing it would miss their cached responses. */
export const BasicVisualSchema = z.strictObject(basicVisual);

export const FractionGenVisualSchema = z.strictObject({
  ...basicVisual,
  kind: z.enum(['emoji', 'objects', 'ten-frame', 'fraction']),
  ...fractionFields,
});

/** Reads either kind of output: basic pictures lack the fraction fields. */
export const GenVisualSchema = z.strictObject({
  ...basicVisual,
  kind: z.enum(['emoji', 'objects', 'ten-frame', 'fraction']),
  ...z.object(fractionFields).partial().shape,
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

function contentSchema<V extends z.ZodType>(visual: V) {
  const choice = z.strictObject({
    id: z.enum(['a', 'b', 'c', 'd']),
    kind: z.enum(['number', 'text', 'visual']),
    value: z.number().nullable(),
    text: z.string().nullable(),
    visual: visual.nullable(),
    /** Spoken label of a visual choice. */
    narration: z.string().nullable(),
  });
  const item = z.strictObject({
    type: z.enum(['tap', 'keypad', 'number-line']),
    difficulty: z.number().int(),
    narration: z.string(),
    prompt: z.string(),
    why: z.string(),
    visual: visual.nullable(),
    choices: z.array(choice),
    answerChoiceId: z.string(),
    answer: z.number().nullable(),
    min: z.number().nullable(),
    max: z.number().nullable(),
    step: z.number().nullable(),
    target: z.number().nullable(),
    check: GenCheckSchema,
  });
  const card = z.strictObject({
    narration: z.string(),
    text: z.string().nullable(),
    visual: visual.nullable(),
  });
  return z.strictObject({ cards: z.array(card), items: z.array(item) });
}

/** The tool schema for skills with basic pictures. */
export const BasicContentSchema = contentSchema(BasicVisualSchema);
/** The tool schema for skills that may draw fraction pictures. */
export const FractionContentSchema = contentSchema(FractionGenVisualSchema);

export const GeneratedContentSchema = contentSchema(GenVisualSchema);
export type GeneratedContent = z.infer<typeof GeneratedContentSchema>;
export type GenItem = GeneratedContent['items'][number];
export type GenChoice = GenItem['choices'][number];
export type GenCard = GeneratedContent['cards'][number];

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
