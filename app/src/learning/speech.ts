import { toSpeech, type Choice, type Item } from '@bright-trail/shared';
import { choiceText } from '../narration/choiceText';

const spokenWords = (text: string) =>
  ` ${toSpeech(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

/**
 * The question as spoken. Item narration should already name tap choices, so they're read after
 * it only when it misses one, such as a picture choice. Then all are read, in screen order.
 */
export function questionSpeech(item: Item, choices?: readonly Choice[]): string[] {
  if (item.type !== 'tap') return [item.narration];
  const said = spokenWords(item.narration);
  const order = choices ?? item.choices;
  if (order.every((c) => said.includes(spokenWords(choiceText(c))))) return [item.narration];
  return [item.narration, ...order.map(choiceText)];
}
