import { z } from 'zod';
import type { Item } from './item';
import { choiceTextValue, itemAnswer, PersonSchema } from './scene';
import {
  FRACTION_FOOD_IDS,
  FRACTION_FOODS,
  FRACTION_MAX_WHOLES,
  FRACTION_PARTS,
  FRACTION_SHAPES,
} from './visual';

/**
 * What a slice scene asks, and how the app plays it out:
 * - `picked`: `picked` slices pull out, counted as 1/parts, 2/parts, ...
 * - `left`: `take` slices get eaten. The slices still there get counted.
 * - `parts`: the whole gets cut into `parts` slices, then they get counted.
 * - `each`: the slices go to `friends` kids. Each kid's share is counted.
 * - `same`: the `picked` slices get cut again (or joined) into `cutInto` slices per whole.
 * - `bigger`: one slice of `parts` and one of `other` slices line up. `want` picks the answer.
 * - `add`: `picked` slices pull out, then `more` slices join them.
 */
export const SLICE_ASKS = ['picked', 'left', 'parts', 'each', 'same', 'bigger', 'add'] as const;
export type SliceAsk = (typeof SLICE_ASKS)[number];

const Parts = z.number().int().min(FRACTION_PARTS.min).max(FRACTION_PARTS.max);
const Count = z.number().int().min(0);

export const SliceSceneSchema = z
  .object({
    kind: z.literal('slices'),
    ask: z.enum(SLICE_ASKS),
    shape: z.enum(FRACTION_SHAPES),
    /** Without a food the shape is drawn plain, for stories about circles and strips. */
    food: z.enum(FRACTION_FOOD_IDS).optional(),
    parts: Parts,
    wholes: z.number().int().min(1).max(FRACTION_MAX_WHOLES).optional(),
    picked: Count.optional(),
    /** Slices already gone when the story starts. */
    eaten: Count.optional(),
    take: Count.optional(),
    more: Count.optional(),
    cutInto: Parts.optional(),
    other: Parts.optional(),
    want: z.enum(['bigger', 'smaller']).optional(),
    friends: z.number().int().min(2).max(6).optional(),
    /** Who picks, eats, or shares, when the story names them. */
    who: PersonSchema.optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const total = s.parts * (s.wholes ?? 1);
    const used = (s.picked ?? 0) + (s.eaten ?? 0) + (s.take ?? 0) + (s.more ?? 0);
    if (used > total) issue('picked', `the story uses ${used} slices but there are ${total}`);
    if (s.food && FRACTION_FOODS[s.food] !== s.shape) {
      issue('food', `${s.food} is a ${FRACTION_FOODS[s.food]}, not a ${s.shape}`);
    }
    const needs: Partial<Record<SliceAsk, (keyof typeof s)[]>> = {
      picked: ['picked'],
      left: ['take'],
      same: ['picked', 'cutInto'],
      bigger: ['other'],
      add: ['picked', 'more'],
    };
    for (const key of needs[s.ask] ?? []) {
      if (s[key] === undefined) issue(key, `ask ${s.ask} needs ${key}`);
    }
    if (s.ask === 'same' && s.cutInto === s.parts)
      issue('cutInto', 'cutInto must differ from parts');
    if (s.ask === 'bigger' && s.other === s.parts) issue('other', 'other must differ from parts');
    if (s.ask === 'each' && (s.wholes ?? 1) > 1) issue('wholes', 'ask each shares one whole');
    if (s.ask === 'each' && total % (s.friends ?? s.parts) !== 0) {
      issue('friends', `${total} slices don't split evenly among ${s.friends} friends`);
    }
    if (s.ask === 'same' && s.cutInto && ((s.picked ?? 0) * s.cutInto) % s.parts !== 0) {
      issue('cutInto', `${s.picked}/${s.parts} is not a whole number of 1/${s.cutInto} slices`);
    }
  });
export type SliceScene = z.infer<typeof SliceSceneSchema>;

export const sliceTotal = (s: SliceScene) => s.parts * (s.wholes ?? 1);

/** Slices still there when a `left` story ends. */
export const slicesLeft = (s: SliceScene) => sliceTotal(s) - (s.eaten ?? 0) - (s.take ?? 0);

/**
 * The answers the scene shows. Counts and fractions both count: a story where 3 of 4 slices are
 * picked answers "3" to "how many slices" and "3/4" to "what part".
 */
export function sliceValues(s: SliceScene): number[] {
  const of = (n: number, parts = s.parts) => [n, n / parts];
  switch (s.ask) {
    case 'picked':
      return of(s.picked!);
    case 'left':
      return of(slicesLeft(s));
    case 'parts':
      return [s.parts];
    case 'each': {
      const each = sliceTotal(s) / (s.friends ?? s.parts);
      return of(each);
    }
    case 'same': {
      const n = (s.picked! * s.cutInto!) / s.parts;
      return of(n, s.cutInto);
    }
    case 'bigger': {
      const pick = s.want === 'smaller' ? Math.max : Math.min;
      return [1 / pick(s.parts, s.other!)];
    }
    case 'add':
      return of(s.picked! + s.more!);
  }
}

const close = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Why the scene can't play this item. Empty when it can. */
export function sliceProblems(item: Item, scene: SliceScene): string[] {
  const problems: string[] = [];
  const answer = itemAnswer(item);
  const values = sliceValues(scene);
  if (typeof answer !== 'number') problems.push('the item answer is not a number');
  else if (!values.some((v) => close(v, answer))) {
    problems.push(`the scene shows ${values.join(' or ')} but the item answers ${answer}`);
  }
  if (item.type === 'tap') {
    for (const c of item.choices) {
      if (c.kind === 'visual') {
        problems.push(`choice ${c.id} is a picture`);
        continue;
      }
      // "Same" can stand beside two fractions. Anything else must be a number to play out.
      const v = c.kind === 'number' ? c.value : choiceTextValue(c.text);
      if (typeof v !== 'number' && !(scene.ask === 'bigger' && c.id !== item.answerChoiceId)) {
        problems.push(`choice ${c.id} is not a number`);
      }
    }
  } else if (typeof answer === 'number' && !Number.isInteger(answer)) {
    problems.push('a typed answer must be a whole number');
  }
  return problems;
}
