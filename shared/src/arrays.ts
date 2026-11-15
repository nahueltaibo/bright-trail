import { z } from 'zod';
import type { Item } from './item';
import { choiceTextValue, itemAnswer, THING_IDS, THINGS } from './scene';

/**
 * What an array scene asks about `rows` rows of `columns` things:
 * - `total`: how many in all.
 * - `rows`: the total fills rows of `columns`. How many rows?
 * - `columns`: the total deals into `rows` rows. How many in each row?
 * - `turn`: the array turns a quarter, so `columns` rows of `rows` make the same total. `find`
 *   names the number the item wants.
 * - `split`: a line cuts the array in two at `split.at`. `find` names the number the item wants.
 */
export const ARRAY_ASKS = ['total', 'rows', 'columns', 'turn', 'split'] as const;
export type ArrayAsk = (typeof ARRAY_ASKS)[number];

/** What a `turn` ask wants: the total, or the start array's rows or columns. */
export const TURN_FINDS = ['total', 'rows', 'columns'] as const;
/** What a `split` ask wants: the total, or the size of the first or second part along the cut. */
export const SPLIT_FINDS = ['total', 'first', 'second'] as const;

/** Most rows and columns. A 10 × 10 array still fits a phone at about 24 points a thing. */
export const ARRAY_MAX = 10;

const NUMBER_WORDS = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
];

/**
 * Whether a number-line prompt holds a whole-number × or ÷ fact, which an array can show.
 * "3 hops of 2" keeps its frog, and "5 × 1/2" has no whole rows.
 */
export const isArrayFact = (prompt: string) => /[×÷]/.test(prompt) && !/\d\/\d/.test(prompt);

const Side = z.number().int().min(1).max(ARRAY_MAX);

export const ArraySceneSchema = z
  .object({
    kind: z.literal('arrays'),
    ask: z.enum(ARRAY_ASKS),
    rows: Side,
    columns: Side,
    /** Drawn as this thing. Plain counters when the item names nothing that fits. */
    thing: z.enum(THING_IDS).optional(),
    find: z.enum([...TURN_FINDS, 'first', 'second']).optional(),
    /** Where the cut falls: after `at` rows, or after `at` columns. */
    split: z.object({ by: z.enum(['rows', 'columns']), at: z.number().int().min(1) }).optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (s.ask === 'turn') {
      if (s.rows === s.columns) issue('columns', 'a square looks the same turned');
      if (!(TURN_FINDS as readonly string[]).includes(s.find ?? '')) {
        issue('find', `turn finds ${TURN_FINDS.join(', ')}`);
      }
    } else if (s.ask === 'split') {
      if (!(SPLIT_FINDS as readonly string[]).includes(s.find ?? '')) {
        issue('find', `split finds ${SPLIT_FINDS.join(', ')}`);
      }
      if (!s.split) issue('split', 'split needs a cut');
      else if (s.split.at >= s[s.split.by])
        issue('split', `the cut must fall inside the ${s.split.by}`);
    } else if (s.find !== undefined) issue('find', `ask ${s.ask} takes no find`);
    if (s.ask !== 'split' && s.split !== undefined) issue('split', `ask ${s.ask} takes no cut`);
    if (s.ask === 'rows' && s.rows < 2) issue('rows', 'one row is not an array to count');
    if (s.ask === 'columns' && s.columns < 2) issue('columns', 'one in a row is not a row to fill');
  });
export type ArrayScene = z.infer<typeof ArraySceneSchema>;

/** The two parts of a split array, each as rows × columns. */
export function arrayParts(
  s: ArrayScene,
): [{ rows: number; columns: number }, { rows: number; columns: number }] {
  const { by, at } = s.split!;
  return by === 'rows'
    ? [
        { rows: at, columns: s.columns },
        { rows: s.rows - at, columns: s.columns },
      ]
    : [
        { rows: s.rows, columns: at },
        { rows: s.rows, columns: s.columns - at },
      ];
}

/** The number the scene's play-out lands on. */
export function arrayAnswer(s: ArrayScene): number {
  const total = s.rows * s.columns;
  switch (s.ask) {
    case 'total':
      return total;
    case 'rows':
      return s.rows;
    case 'columns':
      return s.columns;
    case 'turn':
      return s.find === 'rows' ? s.rows : s.find === 'columns' ? s.columns : total;
    case 'split': {
      if (s.find === 'total') return total;
      const part = arrayParts(s)[s.find === 'first' ? 0 : 1];
      return s.split!.by === 'rows' ? part.rows : part.columns;
    }
  }
}

/** The numbers the item must say for the child to work it out. */
function given(s: ArrayScene): number[] {
  const total = s.rows * s.columns;
  switch (s.ask) {
    case 'total':
    case 'turn':
      return [s.rows, s.columns];
    case 'rows':
      return [total, s.columns];
    case 'columns':
      return [total, s.rows];
    case 'split': {
      const { by } = s.split!;
      const along = s[by];
      const [a, b] = arrayParts(s).map((p) => p[by]);
      const other = by === 'rows' ? s.columns : s.rows;
      if (s.find === 'total') return [other, a, b];
      return [other, along, s.find === 'first' ? b : a];
    }
  }
}

/** Why the scene can't play this item. Empty when it can. */
export function arrayProblems(item: Item, scene: ArrayScene): string[] {
  const problems: string[] = [];
  const answer = itemAnswer(item);
  const shown = arrayAnswer(scene);
  if (typeof answer !== 'number') problems.push('the item answer is not a number');
  else if (answer !== shown)
    problems.push(`the scene finds ${shown} but the item answers ${answer}`);
  if (item.type === 'number-line' && !isArrayFact(item.prompt))
    problems.push('number-line items without a × or ÷ fact keep their frog');
  // The stage replaces the item's picture. Only a picture of things it can draw again is safe.
  const visual = 'visual' in item ? item.visual : undefined;
  if (visual && visual.kind !== 'objects') problems.push(`the item has a ${visual.kind} picture`);
  // A picture of the whole total shows the array's things. Any other count shows its groups,
  // like 4 ducks for "4 ducks with 2 legs each", so the array must not draw those.
  const pictured =
    visual?.kind === 'objects' && THING_IDS.find((t) => THINGS[t].emoji === visual.emoji);
  if (visual?.kind === 'objects' && pictured) {
    const total = visual.count === scene.rows * scene.columns;
    if (total && scene.thing !== pictured)
      problems.push(
        `the picture shows ${visual.count} ${pictured}s, not ${scene.thing ?? 'counter'}s`,
      );
    if (!total && scene.thing === pictured)
      problems.push(`the picture shows ${visual.count} ${pictured}s, not the array's things`);
  }
  if (item.type === 'tap') {
    const numbers = item.choices.every(
      (c) =>
        c.kind === 'number' || (c.kind === 'text' && typeof choiceTextValue(c.text) === 'number'),
    );
    if (!numbers) problems.push('a choice is not a number');
  }
  const words = `${item.prompt} ${item.narration}`;
  const said = (n: number) =>
    new RegExp(`(^|[^\\d./])${n}(?![\\d/]|\\.\\d)`).test(words) ||
    (n <= ARRAY_MAX && new RegExp(`\\b${NUMBER_WORDS[n]}\\b`, 'i').test(words));
  for (const n of new Set(given(scene))) if (!said(n)) problems.push(`the item never says ${n}`);
  return problems;
}
