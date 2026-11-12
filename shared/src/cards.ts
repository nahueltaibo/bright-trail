import { z } from 'zod';
import type { Item } from './item';

/** Longest card or tag text. Longer words don't fit a card on a phone. */
export const MAX_CARD_TEXT = 24;

export const CardSchema = z.object({
  text: z.string().trim().min(1).max(MAX_CARD_TEXT),
  /** Drawn above the text, so children who can't read yet still know the card. */
  emoji: z.string().trim().min(1).max(8).optional(),
});
export type Card = z.infer<typeof CardSchema>;

const norm = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase();

/** Card words match without case or extra spaces, so "Solid" fits the choice "solid". */
export const sameText = (a: string, b: string) => norm(a) === norm(b);

/** The tap item's text choices and answer. Null unless it's a tap item with only text choices. */
export function textChoices(item: Item): { texts: string[]; answer: string } | null {
  if (item.type !== 'tap') return null;
  const texts: string[] = [];
  for (const c of item.choices) {
    if (c.kind !== 'text') return null;
    texts.push(c.text);
  }
  const answer = item.choices.find((c) => c.id === item.answerChoiceId);
  return answer?.kind === 'text' ? { texts, answer: answer.text } : null;
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Whether the item's prompt or narration says the text, as whole words. */
export function itemSays(item: Item, text: string): boolean {
  const words = norm(`${item.prompt} ${item.narration}`);
  return new RegExp(`(^|[^a-z0-9])${escape(norm(text))}(?![a-z0-9])`).test(words);
}

/** Problems every card game shares: it needs a tap item with text choices and no picture. */
export function cardItemProblems(item: Item): string[] {
  const problems: string[] = [];
  if (!textChoices(item)) problems.push('the item is not a tap item with text choices');
  // The stage replaces the item's picture, which would then go unseen.
  if ('visual' in item && item.visual) problems.push(`the item has a ${item.visual.kind} picture`);
  return problems;
}

/** The texts that repeat an earlier one, without case. */
export function repeats(texts: string[]): string[] {
  return texts.filter((t, i) => texts.findIndex((u) => sameText(t, u)) !== i);
}
