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
import { cardItems, cardTagRequest, isYesNo, TaggedCardSchema, toCard } from '../games/cards';
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

const SEQUENCE = /\b(first|second|third|next|then|after|before|last|steps?|stages?)\b/i;

/** Text tap items that talk about a sequence, like "What comes after build?". */
export function orderCandidates(items: readonly Item[]): Item[] {
  return cardItems(items, 'order').filter(
    (i) => SEQUENCE.test(`${i.prompt} ${i.narration}`) && !isYesNo(i),
  );
}

/** Where the gap must sit: first, last, or next to a named card, like "after build". */
export type GapAsk = { at: 'first' | 'last' } | { at: 'after' | 'before'; card: string };

const NEIGHBOUR = /\b(after|before)\s+(?:the\s+|a\s+|an\s+)?([^?.!,:;]+)/i;

function askIn(words: string): GapAsk | undefined {
  const near = NEIGHBOUR.exec(words);
  if (near) return { at: near[1]!.toLowerCase() as 'after' | 'before', card: near[2]!.trim() };
  if (/\blast\b/i.test(words)) return { at: 'last' };
  if (/\bfirst\b/i.test(words)) return { at: 'first' };
  return undefined;
}

/** The gap the item asks about, from its prompt, else its narration. None for "next" or "then". */
export function gapAsk(item: Item): GapAsk | undefined {
  return askIn(item.prompt) ?? askIn(item.narration);
}

const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();
const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Whether the words name the card as whole words, so "tadpole stage" names Tadpole. */
function names(words: string, card: string | undefined): boolean {
  if (card === undefined) return false;
  return new RegExp(`(^|[^a-z0-9])${escape(norm(card))}(?![a-z0-9])`).test(norm(words));
}

/** Why the gap sits somewhere other than where the item asks. Empty when it fits. */
export function gapProblems(item: Item, scene: OrderScene): string[] {
  const ask = gapAsk(item);
  if (!ask) return [];
  const n = scene.cards.length;
  // A cycle wraps, so the card after the last is the first.
  const at = (i: number) => scene.cards[scene.cycle ? (i + n) % n : i]?.text;
  if (ask.at === 'first' && scene.missing !== 0) return ['the item asks for the first card'];
  if (ask.at === 'last' && !scene.cycle && scene.missing !== n - 1) {
    return ['the item asks for the last card'];
  }
  if (ask.at === 'after' && !names(ask.card, at(scene.missing - 1))) {
    return [`the card before the gap is not ${ask.card}`];
  }
  if (ask.at === 'before' && !names(ask.card, at(scene.missing + 1))) {
    return [`the card after the gap is not ${ask.card}`];
  }
  return [];
}

const SYSTEM = `You map practice items for kids to a row of cards in order. The app shows the cards left to right, like the steps of a job or the stages of a life cycle, with one slot empty. The child picks the choice that fills the slot. The app checks the scene against the item.

For each item give:
- cards: 3 to ${MAX_ORDER} cards in order. Each has text of at most ${MAX_CARD_TEXT} letters and an emoji that shows it, or null when no emoji fits.
- missing: the index of the empty slot, from 0. That card's text is the item's answer, exactly.
- cycle: true when the last card leads back to the first, like seasons, day and night, or a life cycle.

Rules:
- The row is the order the item asks about, in the item's words. "What comes after build?" with the answer test is a row like build, test, make it better, with test missing.
- Each card names a step, stage, or event itself, written like the item's choices, such as butterfly or Dad was born. Never a position, like first move, or a description, like flying wings.
- No other card may say one of the item's choices, since that choice would then have two places. Leave those steps out, and start or end the row elsewhere so it still has 3 cards in order.
- The gap sits where the item asks: an item about what comes first leaves the first slot empty, one about what comes last leaves the last slot, and "after build" puts the gap right after the build card.
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
    const problems = [...orderProblems(item, candidate.data), ...gapProblems(item, candidate.data)];
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
  return applyGame(bundle, 'order', scenes, (item, scene) => [
    ...orderProblems(item, scene),
    ...gapProblems(item, scene),
  ]);
}
