import { z } from 'zod';

// Short cap keeps a field to one emoji (ZWJ sequences included) rather than a sentence or URL.
const EmojiSchema = z.string().min(1).max(16);

export const FRACTION_SHAPES = ['circle', 'rectangle', 'bar'] as const;
export const FRACTION_PARTS = { min: 2, max: 12 } as const;
/** More wholes than this don't fit side by side on a phone. */
export const FRACTION_MAX_WHOLES = 4;

/**
 * One or more equal shapes, each cut into `parts` equal parts, with `shaded` parts filled in
 * order across the shapes. 3 of 4 shaded is 3/4. With 2 wholes, 7 of 4 shaded is 7/4.
 */
export const FractionVisualSchema = z
  .object({
    kind: z.literal('fraction'),
    /** `rectangle` cuts into a grid, `bar` into one strip like a fraction strip. */
    shape: z.enum(FRACTION_SHAPES),
    parts: z.number().int().min(FRACTION_PARTS.min).max(FRACTION_PARTS.max),
    shaded: z.number().int().min(0),
    wholes: z.number().int().min(1).max(FRACTION_MAX_WHOLES).optional(),
    /** Short screen text under the picture, such as "3/4". */
    label: z.string().min(1).max(12).optional(),
  })
  .superRefine((v, ctx) => {
    const max = v.parts * (v.wholes ?? 1);
    if (v.shaded > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['shaded'],
        message: `shaded is ${v.shaded} but the picture has only ${max} parts`,
      });
    }
  });
export type FractionVisual = z.infer<typeof FractionVisualSchema>;

/** A picture the app draws from data. The POC has no image assets. */
export const VisualSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('emoji'), emoji: EmojiSchema }),
  /** `count` copies of one emoji, e.g. 5 apples to count. */
  z.object({
    kind: z.literal('objects'),
    emoji: EmojiSchema,
    count: z.number().int().min(1).max(20),
  }),
  z.object({ kind: z.literal('ten-frame'), filled: z.number().int().min(0).max(10) }),
  FractionVisualSchema,
]);
export type Visual = z.infer<typeof VisualSchema>;

/**
 * The picture in words, for screen readers and reviewers: "a circle cut into 4 equal parts, 3
 * shaded". Digits stay digits, so `toSpeech` can read it.
 */
export function describeVisual(visual: Visual): string {
  switch (visual.kind) {
    case 'emoji':
      return visual.emoji;
    case 'objects':
      return `${visual.count} ${visual.emoji}`;
    case 'ten-frame':
      return `Ten frame with ${visual.filled} filled`;
    case 'fraction': {
      const wholes = visual.wholes ?? 1;
      const shapes = wholes === 1 ? `a ${visual.shape}` : `${wholes} ${visual.shape}s, each`;
      return `${shapes} cut into ${visual.parts} equal parts, ${visual.shaded} shaded`;
    }
  }
}
