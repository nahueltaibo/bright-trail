import { z } from 'zod';
import type { Item } from './item';
import { itemAnswer, parseMixed, type SceneAnswer } from './scene';

/** A whole is a strip of 10 tenths or a 10 × 10 grid of hundredths. */
export const GRID_UNITS = { tenths: 10, hundredths: 100 } as const;
export type GridUnit = keyof typeof GRID_UNITS;

/** Most wholes one amount fills. More strips or grids get too small on a phone. */
export const GRID_WHOLES: Record<GridUnit, number> = { tenths: 4, hundredths: 2 };

/**
 * What a grid scene asks about the part it fills:
 * - `decimal`, `fraction`, `percent`: the amount written that way.
 * - `parts`: how many tenths or hundredths it fills.
 * - `same`: whether `amount` and `other` fill the same part, answered yes or no.
 */
export const GRID_ASKS = ['decimal', 'fraction', 'percent', 'parts', 'same'] as const;
export type GridAsk = (typeof GRID_ASKS)[number];

const DECIMAL = /^\d*\.?\d+$/;
const PERCENT = /^(\d+(?:\.\d+)?)\s?%$/;

/** Reads "0.4", "7/10", "1 1/4", or "30%" as an amount of one whole. Null for anything else. */
export function gridValue(text: string): number | null {
  const t = text.trim();
  const percent = PERCENT.exec(t);
  if (percent) return Number(percent[1]) / 100;
  return DECIMAL.test(t) ? Number(t) : parseMixed(t);
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** How many tenths or hundredths `text` fills. Null when it isn't a whole count of them. */
export function gridParts(text: string, unit: GridUnit): number | null {
  const v = gridValue(text);
  if (v === null) return null;
  const parts = v * GRID_UNITS[unit];
  return near(parts, Math.round(parts)) ? Math.round(parts) : null;
}

const AmountText = z
  .string()
  .trim()
  .refine((t) => gridValue(t) !== null, { message: 'not a decimal, fraction, or percent' });

export const GridSceneSchema = z
  .object({
    kind: z.literal('grid'),
    unit: z.enum(Object.keys(GRID_UNITS) as [GridUnit, ...GridUnit[]]),
    ask: z.enum(GRID_ASKS),
    /** The part the picture fills, as the item writes it, like "9/10", "0.25", or "30%". */
    amount: AmountText,
    /** For a `same` ask, the amount the second picture fills. */
    other: AmountText.optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const fits = (path: 'amount' | 'other', text: string) => {
      const parts = gridParts(text, s.unit);
      if (parts === null) issue(path, `${text} is not a whole number of ${s.unit}`);
      else if (parts <= 0) issue(path, `${text} fills nothing`);
      else if (parts > GRID_UNITS[s.unit] * GRID_WHOLES[s.unit]) {
        issue(path, `${text} needs more than ${GRID_WHOLES[s.unit]} wholes`);
      }
    };
    fits('amount', s.amount);
    if (s.ask === 'same') {
      if (s.other === undefined) issue('other', 'same needs an other amount');
      else fits('other', s.other);
    } else if (s.other !== undefined) issue('other', `ask ${s.ask} takes no other amount`);
  });
export type GridScene = z.infer<typeof GridSceneSchema>;

/** The amounts the scene's pictures fill, as part counts: one, or two for a `same` ask. */
export function gridFills(s: GridScene): number[] {
  const texts = s.other === undefined ? [s.amount] : [s.amount, s.other];
  return texts.map((t) => gridParts(t, s.unit)!);
}

/**
 * The answer the scene plays out, in the form the item answers it. A percent is 25 on a keypad,
 * but a "25%" choice reads as 0.25.
 */
export function gridAnswer(s: GridScene, item: Pick<Item, 'type'>): SceneAnswer {
  const [a, b] = gridFills(s);
  const size = GRID_UNITS[s.unit];
  switch (s.ask) {
    case 'decimal':
    case 'fraction':
      return a / size;
    case 'percent':
      return item.type === 'tap' ? a / size : (a * 100) / size;
    case 'parts':
      return a;
    case 'same':
      return a === b;
  }
}

/** Why the scene can't play this item. Empty when it can. */
export function gridProblems(item: Item, scene: GridScene): string[] {
  const problems: string[] = [];
  if (item.type === 'number-line') return ['number-line items keep their own screen'];
  // The stage replaces the item's picture, which would then go unseen.
  if (item.visual) problems.push(`the item has a ${item.visual.kind} picture`);

  const answer = itemAnswer(item);
  const expected = gridAnswer(scene, item);
  const shown = (v: SceneAnswer) => (typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v));
  if (answer === null) problems.push('the item answer is not a number or yes or no');
  else if (
    typeof answer !== typeof expected ||
    (typeof answer === 'number' ? !near(answer, expected as number) : answer !== expected)
  ) {
    problems.push(`the scene answers ${shown(expected)} but the item answers ${shown(answer)}`);
  }

  const words = `${item.prompt} ${item.narration}`.toLowerCase();
  // A count of parts only matches the picture when the item counts the same parts.
  if (scene.ask === 'parts') {
    const size = GRID_UNITS[scene.unit];
    const one = scene.unit.slice(0, -1);
    const named = new RegExp(`\\b${one}s?\\b|/${size}\\b|\\b(denominator|out of) ${size}\\b`);
    if (!named.test(words)) problems.push(`the item never counts ${scene.unit}`);
  }
  if (scene.ask === 'same') {
    const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    for (const v of [scene.amount, scene.other!]) {
      if (!new RegExp(`(^|[^\\d./])${escape(v)}(?![\\d/]|\\.\\d)`).test(words)) {
        problems.push(`the item never says ${v}`);
      }
    }
  }
  return problems;
}
