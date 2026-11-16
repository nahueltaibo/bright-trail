import { z } from 'zod';
import { AttemptPhaseSchema } from './attempt';
import { IdSchema, IsoDateTimeSchema, NonEmptyTextSchema } from './common';
import { ItemSchema } from './item';

export const REPORT_COMMENT_MAX = 500;
/** The largest capture the Worker takes. The app drops a capture it can't fit under this. */
export const REPORT_CAPTURE_MAX_BYTES = 400 * 1024;

const NullableTextSchema = NonEmptyTextSchema.nullable();

/**
 * A flagged item or story card, as the app uploads it and the Worker and triage CLI read it.
 * Strict at every level, so a field like a child id can't ride along.
 */
export const ReportSchema = z
  .strictObject({
    /** Made on the device, so a retried upload doesn't add a second report. */
    id: z.uuid(),
    createdAt: IsoDateTimeSchema,
    /** Null when the tester sends no comment. The app turns blank text into null. */
    comment: NonEmptyTextSchema.max(REPORT_COMMENT_MAX).nullable(),
    target: z.strictObject({
      contentKind: z.enum(['item', 'card']),
      /** Item id, or the nugget id for a card. */
      contentId: IdSchema,
      /** Position of the card in its nugget. Null for items. */
      cardIndex: z.number().int().min(0).nullable(),
    }),
    /** The item as shown, game and scene included, so it replays after a regeneration. Null for cards. */
    item: ItemSchema.nullable(),
    skillId: IdSchema,
    phase: AttemptPhaseSchema,
    content: z.strictObject({
      bundleVersion: NonEmptyTextSchema,
      coreHash: z.string().regex(/^[0-9a-f]{64}$/),
      contentSchemaVersion: z.number().int().positive(),
    }),
    app: z.strictObject({
      appVersion: NonEmptyTextSchema,
      /** Null in dev and on web. */
      runtimeVersion: NullableTextSchema,
      /** Null when the APK runs its embedded JS. */
      updateId: NullableTextSchema,
    }),
    device: z.strictObject({
      platform: z.enum(['android', 'ios', 'web']),
      /** Null where the platform doesn't say, as on web. */
      osVersion: NullableTextSchema,
      model: NullableTextSchema,
    }),
    /** The whole screen in density-independent pixels, as the device was held. */
    screen: z.strictObject({
      width: z.number().positive(),
      height: z.number().positive(),
      scale: z.number().positive(),
      fontScale: z.number().positive(),
    }),
    settings: z.strictObject({ readingMode: z.boolean(), dyslexicFont: z.boolean() }),
    /** True when a capture file uploads with the report. */
    hasCapture: z.boolean(),
  })
  .superRefine((report, ctx) => {
    const { target, item } = report;
    if ((target.contentKind === 'card') !== (target.cardIndex !== null)) {
      ctx.addIssue({
        code: 'custom',
        path: ['target', 'cardIndex'],
        message: 'cardIndex is required for cards and must be null for items',
      });
    }
    if (target.contentKind === 'card') {
      if (item !== null) {
        ctx.addIssue({ code: 'custom', path: ['item'], message: 'A card report has no item' });
      }
      return;
    }
    if (item === null) {
      ctx.addIssue({ code: 'custom', path: ['item'], message: 'An item report needs the item' });
      return;
    }
    if (item.id !== target.contentId) {
      ctx.addIssue({
        code: 'custom',
        path: ['item', 'id'],
        message: 'item.id must match contentId',
      });
    }
    if (item.skillId !== report.skillId) {
      ctx.addIssue({ code: 'custom', path: ['skillId'], message: 'skillId must match the item' });
    }
  });
export type Report = z.infer<typeof ReportSchema>;
