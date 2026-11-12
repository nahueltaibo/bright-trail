import { z } from 'zod';
import { CardSchema, cardItemProblems, itemSays, repeats, sameText, textChoices } from './cards';
import type { Item } from './item';

/** Most cards already in bins, so the stage stays readable on a phone. */
export const MAX_SORTED = 6;

export const SortSceneSchema = z
  .object({
    kind: z.literal('sort'),
    /** 2 to 4 groups, like "Living" and "Not living". */
    bins: z.array(CardSchema).min(2).max(4),
    /** Cards already in their bins, as examples. */
    sorted: z.array(z.object({ card: CardSchema, bin: z.number().int().min(0) })).max(MAX_SORTED),
    /** The card the child sorts. */
    card: CardSchema,
    /** The bin it belongs in. */
    bin: z.number().int().min(0),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (s.bin >= s.bins.length) issue('bin', 'bin is past the last bin');
    if (s.sorted.some((c) => c.bin >= s.bins.length)) issue('sorted', 'a card is in a missing bin');
    for (const t of repeats(s.bins.map((b) => b.text))) issue('bins', `${t} repeats`);
    for (const t of repeats([s.card.text, ...s.sorted.map((c) => c.card.text)])) {
      issue('sorted', `${t} repeats`);
    }
  });
export type SortScene = z.infer<typeof SortSceneSchema>;

/** Why the scene can't play this item. Empty when it can. */
export function sortProblems(item: Item, scene: SortScene): string[] {
  const problems = cardItemProblems(item);
  const choices = textChoices(item);
  if (choices) {
    // The choices are the bins: the child picks the bin the card drops into.
    const bins = scene.bins.map((b) => b.text);
    const unbinned = choices.texts.filter((t) => !bins.some((b) => sameText(b, t)));
    if (unbinned.length) problems.push(`no bin for the choice ${unbinned.join(', ')}`);
    const unchosen = bins.filter((b) => !choices.texts.some((t) => sameText(b, t)));
    if (unchosen.length) problems.push(`no choice for the bin ${unchosen.join(', ')}`);
    const right = scene.bins[scene.bin]?.text;
    if (right && !sameText(right, choices.answer)) {
      problems.push(`the card goes in ${right} but the item answers ${choices.answer}`);
    }
  }
  if (!itemSays(item, scene.card.text)) problems.push(`the item never says ${scene.card.text}`);
  return problems;
}
