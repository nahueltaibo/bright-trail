import { z } from 'zod';

// Short cap keeps a field to one emoji (ZWJ sequences included) rather than a sentence or URL.
const EmojiSchema = z.string().min(1).max(16);

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
]);
export type Visual = z.infer<typeof VisualSchema>;
