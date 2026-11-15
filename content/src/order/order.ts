import {
  MAX_CARD_TEXT,
  MAX_ORDER,
  OrderSceneSchema,
  orderProblems,
  type ContentBundle,
  type Item,
  type OrderScene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { cardItems, cardTagRequest, TaggedCardSchema, toCard } from '../games/cards';
import type { LlmRequest } from '../graph/llm';

// Flat, like the content schema: structured output follows it more reliably.
const TaggedOrderSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  cards: z.array(TaggedCardSchema),
  missing: z.number().int(),
  cycle: z.boolean(),
  note: z.string(),
});
export const OrderTagOutputSchema = z.strictObject({ scenes: z.array(TaggedOrderSchema) });
export type TaggedOrder = z.infer<typeof TaggedOrderSchema>;

const SEQUENCE = /\b(first|next|after|before|last|steps?|stages?)\b/i;

/** Text tap items that talk about a sequence, like "What comes after build?". */
export function orderCandidates(items: readonly Item[]): Item[] {
  return cardItems(items, 'order').filter((i) => SEQUENCE.test(`${i.prompt} ${i.narration}`));
}

const SYSTEM = `You map practice items for kids to a row of cards in order. The app shows the cards left to right, like the steps of a job or the stages of a life cycle, with one slot empty. The child picks the choice that fills the slot. The app checks the scene against the item.

For each item give:
- cards: 3 to ${MAX_ORDER} cards in order. Each has text of at most ${MAX_CARD_TEXT} letters and an emoji that shows it, or null when no emoji fits.
- missing: the index of the empty slot, from 0. That card's text is the item's answer, exactly.
- cycle: true when the last card leads back to the first, like seasons, day and night, or a life cycle.

Rules:
- The row is the order the item asks about, in the item's words. "What comes after build?" with the answer test is a row like build, test, make it better, with test missing.
- No other card may say one of the item's choices, since that choice would then have two places. Leave those steps out, and start or end the row elsewhere so it still has 3 cards in order.
- Set fits to false when the item isn't about what comes first, next, before, after, or last in a sequence, or when no row of 3 cards can leave out the other choices. Fill the other fields with any valid value then.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

export function orderTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  return cardTagRequest(SYSTEM, OrderTagOutputSchema, skillId, items);
}

export type OrderTagResult = {
  scenes: Record<string, OrderScene>;
  rejected: Record<string, string>;
};

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptOrders(items: readonly Item[], output: unknown): OrderTagResult {
  const parsed = OrderTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: OrderTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const candidate = OrderSceneSchema.safeParse({
      kind: 'order',
      cards: t.cards.map(toCard),
      missing: t.missing,
      ...(t.cycle && { cycle: true }),
    });
    if (!candidate.success) {
      result.rejected[t.itemId] = candidate.error.issues.map((i) => i.message).join('; ');
      continue;
    }
    const problems = orderProblems(item, candidate.data);
    if (problems.length > 0) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = candidate.data;
  }
  return result;
}

/** Adds stored order scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applyOrders(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, OrderScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'order', scenes, orderProblems);
}
