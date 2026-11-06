import { IdSchema, IsoDateTimeSchema, NonEmptyTextSchema } from '@bright-trail/shared';
import { z } from 'zod';

// Lives in the app until shared/ grows a flag schema; the content build never reads flags.
/** A "This looks wrong" tap on a story card or an item. */
export const ContentFlagSchema = z
  .object({
    /** Who tapped it. Null when a parent flags it or the child was later deleted. */
    childId: IdSchema.nullable(),
    contentKind: z.enum(['item', 'card']),
    /** Item id, or the nugget id for a card. */
    contentId: IdSchema,
    /** Position of the card in its nugget. Null for items. */
    cardIndex: z.number().int().min(0).nullable(),
    /** Bundle release the flag was raised on, since fixes ship in a rebuilt bundle. */
    bundleVersion: NonEmptyTextSchema,
    createdAt: IsoDateTimeSchema,
  })
  .refine((f) => (f.contentKind === 'card') === (f.cardIndex !== null), {
    path: ['cardIndex'],
    message: 'cardIndex is required for cards and must be null for items',
  });
export type ContentFlag = z.infer<typeof ContentFlagSchema>;

/** A stored flag with its row id, so a parent screen can act on it. */
export type StoredContentFlag = ContentFlag & {
  id: number;
  /** When a parent marked it handled. Null while open. */
  resolvedAt: string | null;
};
