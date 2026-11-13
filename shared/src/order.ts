import { z } from 'zod';
import { CardSchema, cardItemProblems, repeats, sameText, textChoices } from './cards';
import type { Item } from './item';

/** Most cards in a row. More get too narrow to read on a phone. */
export const MAX_ORDER = 6;

export const OrderSceneSchema = z
  .object({
    kind: z.literal('order'),
    /** The cards in order, like the stages of a life cycle. */
    cards: z.array(CardSchema).min(3).max(MAX_ORDER),
    /** The empty slot the child fills. */
    missing: z.number().int().min(0),
    /** Draws an arrow from the last card back to the first, for seasons and other cycles. */
    cycle: z.boolean().optional(),
  })
  .superRefine((s, ctx) => {
    if (s.missing >= s.cards.length) {
      ctx.addIssue({ code: 'custom', path: ['missing'], message: 'missing is past the last card' });
    }
    for (const t of repeats(s.cards.map((c) => c.text))) {
      ctx.addIssue({ code: 'custom', path: ['cards'], message: `${t} repeats` });
    }
  });
export type OrderScene = z.infer<typeof OrderSceneSchema>;

/** Why the scene can't play this item. Empty when it can. */
export function orderProblems(item: Item, scene: OrderScene): string[] {
  const problems = cardItemProblems(item);
  const choices = textChoices(item);
  const hidden = scene.cards[scene.missing]?.text;
  if (choices && hidden) {
    if (!sameText(hidden, choices.answer)) {
      problems.push(`the missing card is ${hidden} but the item answers ${choices.answer}`);
    }
    // A choice already in the row has two places, so the row can't show where it goes.
    scene.cards.forEach((c, i) => {
      if (i !== scene.missing && choices.texts.some((t) => sameText(t, c.text))) {
        problems.push(`the choice ${c.text} is already in the row`);
      }
    });
  }
  return problems;
}
