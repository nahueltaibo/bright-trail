import { z } from 'zod';

// Short cap keeps a field to one emoji (ZWJ sequences included) rather than a sentence or URL.
const EmojiSchema = z.string().min(1).max(16);

export const FRACTION_SHAPES = ['circle', 'rectangle', 'bar'] as const;
export type FractionShape = (typeof FRACTION_SHAPES)[number];
export const FRACTION_PARTS = { min: 2, max: 12 } as const;
/** More wholes than this don't fit side by side on a phone. */
export const FRACTION_MAX_WHOLES = 4;

/** Foods a fraction picture can draw, and the shape each one is cut as. */
export const FRACTION_FOODS = {
  pizza: 'circle',
  pie: 'circle',
  cookie: 'circle',
  brownies: 'rectangle',
  chocolate: 'rectangle',
  granola: 'bar',
} as const satisfies Record<string, FractionShape>;
export type FractionFood = keyof typeof FRACTION_FOODS;
export const FRACTION_FOOD_IDS = Object.keys(FRACTION_FOODS) as [FractionFood, ...FractionFood[]];

/**
 * One or more equal shapes, each cut into `parts` equal parts. The first `picked` parts, in order
 * across the shapes, are pulled out: 3 of 4 picked is 3/4, and with 2 wholes, 7 of 4 is 7/4. The
 * last `eaten` parts are gone, leaving a gap. Without `food` the shape is drawn plain.
 */
export const FractionVisualSchema = z
  .object({
    kind: z.literal('fraction'),
    /** `rectangle` cuts into a grid, `bar` into one strip like a fraction strip. */
    shape: z.enum(FRACTION_SHAPES),
    food: z.enum(FRACTION_FOOD_IDS).optional(),
    parts: z.number().int().min(FRACTION_PARTS.min).max(FRACTION_PARTS.max),
    picked: z.number().int().min(0),
    eaten: z.number().int().min(1).optional(),
    wholes: z.number().int().min(1).max(FRACTION_MAX_WHOLES).optional(),
    /** Short screen text under the picture, such as "3/4". */
    label: z.string().min(1).max(12).optional(),
  })
  .superRefine((v, ctx) => {
    const max = v.parts * (v.wholes ?? 1);
    if (v.picked + (v.eaten ?? 0) > max) {
      ctx.addIssue({
        code: 'custom',
        path: ['picked'],
        message: `${v.picked} picked and ${v.eaten ?? 0} eaten but the picture has only ${max} parts`,
      });
    }
    if (v.food && FRACTION_FOODS[v.food] !== v.shape) {
      ctx.addIssue({
        code: 'custom',
        path: ['food'],
        message: `${v.food} is a ${FRACTION_FOODS[v.food]}, not a ${v.shape}`,
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
  /** Without `emoji` the filled cells hold dots. */
  z.object({
    kind: z.literal('ten-frame'),
    filled: z.number().int().min(0).max(10),
    emoji: EmojiSchema.optional(),
  }),
  FractionVisualSchema,
]);
export type Visual = z.infer<typeof VisualSchema>;

const FOOD_WORDS: Record<FractionFood, string> = {
  pizza: 'pizza',
  pie: 'pie',
  cookie: 'cookie',
  brownies: 'pan of brownies',
  chocolate: 'chocolate bar',
  granola: 'granola bar',
};

/**
 * The picture in words, for screen readers and reviewers: "a pizza cut into 4 equal parts, 3
 * picked". Digits stay digits, so `toSpeech` can read it.
 */
export function describeVisual(visual: Visual): string {
  switch (visual.kind) {
    case 'emoji':
      return visual.emoji;
    case 'objects':
      return `${visual.count} ${visual.emoji}`;
    case 'ten-frame':
      return visual.emoji
        ? `Ten frame with ${visual.filled} ${visual.emoji}`
        : `Ten frame with ${visual.filled} filled`;
    case 'fraction': {
      const wholes = visual.wholes ?? 1;
      const word = visual.food ? FOOD_WORDS[visual.food] : visual.shape;
      const plural = word.startsWith('pan ') ? word.replace('pan', 'pans') : `${word}s`;
      const shapes = wholes === 1 ? `a ${word}` : `${wholes} ${plural}, each`;
      const eaten = visual.eaten ? `, ${visual.eaten} eaten` : '';
      return `${shapes} cut into ${visual.parts} equal parts, ${visual.picked} picked${eaten}`;
    }
  }
}
