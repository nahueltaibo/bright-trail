import {
  MAX_CARD_TEXT,
  MAX_SORTED,
  SortSceneSchema,
  sameText,
  sortProblems,
  textChoices,
  type ContentBundle,
  type Item,
  type SortScene,
} from '@bright-trail/shared';
import { z } from 'zod';
import { applyGame } from '../apply-game';
import { cardItems, cardTagRequest, TaggedCardSchema, toCard } from '../games/cards';
import type { LlmRequest } from '../graph/llm';

// Flat, like the content schema: structured output follows it more reliably.
const TaggedSortSchema = z.strictObject({
  itemId: z.string(),
  fits: z.boolean(),
  bins: z.array(TaggedCardSchema),
  card: TaggedCardSchema,
  sorted: z.array(z.strictObject({ ...TaggedCardSchema.shape, bin: z.string() })),
  note: z.string(),
});
export const SortTagOutputSchema = z.strictObject({ scenes: z.array(TaggedSortSchema) });
export type TaggedSort = z.infer<typeof TaggedSortSchema>;

const YES_NO = /^(true|false|yes|no)$/i;

/** Text tap items with 2 or 3 choices that could be bins. True or false items aren't sorts. */
export function sortCandidates(items: readonly Item[]): Item[] {
  return cardItems(items, 'sort').filter((i) => {
    const { texts } = textChoices(i)!;
    return texts.length >= 2 && texts.length <= 3 && !texts.every((t) => YES_NO.test(t.trim()));
  });
}

const SYSTEM = `You map practice items for kids to a sorting game. The app shows one bin for each of the item's choices, a few example cards already in their bins, and one card the child sorts. The child drops the card into a bin, which picks that choice. The app checks the scene against the item.

For each item give:
- bins: one per choice, with each choice's text exactly and in the item's order, plus an emoji that shows the group, or null.
- card: the thing the item asks about, in words the item's prompt or narration says, like "a brick" or "place of worship". At most ${MAX_CARD_TEXT} letters, plus an emoji or null.
- sorted: 2 to ${MAX_SORTED} example cards, each with text, an emoji or null, and bin, the text of the bin it goes in. Use clear, everyday examples a young child knows, and put at least one in each bin. Never repeat the card.

Rules:
- Set fits to false unless the item asks which group one thing belongs to, and its choices are the groups, like "Is a brick a liquid or a solid?" or "Natural or built?". Items whose choices are things, actions, or reasons, like "Which is a need: food, or a game?", don't fit. Fill the other fields with any valid value then.
- The card's group must be the item's answer.
- note: one short reason, mainly when fits is false.

Return one entry per item, in order.`;

export function sortTagRequest(skillId: string, items: readonly Item[]): LlmRequest {
  return cardTagRequest(SYSTEM, SortTagOutputSchema, skillId, items);
}

export type SortTagResult = {
  scenes: Record<string, SortScene>;
  rejected: Record<string, string>;
};

/** The scene for a tagged item, with each bin named by its text turned into its index. */
function sceneFor(item: Item, t: TaggedSort): { scene?: SortScene; problems: string[] } {
  const binOf = (text: string) => t.bins.findIndex((b) => sameText(b.text, text));
  const answer = textChoices(item)!.answer;
  const unknown = [answer, ...t.sorted.map((c) => c.bin)].filter((b) => binOf(b) < 0);
  if (unknown.length > 0) return { problems: [`no bin ${[...new Set(unknown)].join(', ')}`] };
  const candidate = SortSceneSchema.safeParse({
    kind: 'sort',
    bins: t.bins.map(toCard),
    sorted: t.sorted.map(({ bin, ...c }) => ({ card: toCard(c), bin: binOf(bin) })),
    card: toCard(t.card),
    bin: binOf(answer),
  });
  if (!candidate.success) return { problems: candidate.error.issues.map((i) => i.message) };
  return { scene: candidate.data, problems: sortProblems(item, candidate.data) };
}

/** Keeps the scenes that parse and match their item. The rest go to `rejected` with a reason. */
export function acceptSorts(items: readonly Item[], output: unknown): SortTagResult {
  const parsed = SortTagOutputSchema.parse(output);
  const byId = new Map(items.map((i) => [i.id, i]));
  const result: SortTagResult = { scenes: {}, rejected: {} };
  for (const t of parsed.scenes) {
    const item = byId.get(t.itemId);
    if (!item) continue;
    if (!t.fits) {
      result.rejected[t.itemId] = `does not fit: ${t.note}`;
      continue;
    }
    const { scene, problems } = sceneFor(item, t);
    if (problems.length > 0 || !scene) result.rejected[t.itemId] = problems.join('; ');
    else result.scenes[t.itemId] = scene;
  }
  return result;
}

/** Adds stored sort scenes to the bundle's items, dropping and reporting any that no longer fit. */
export function applySorts(
  bundle: ContentBundle,
  scenes: Readonly<Record<string, SortScene>>,
): { bundle: ContentBundle; dropped: string[] } {
  return applyGame(bundle, 'sort', scenes, sortProblems);
}
