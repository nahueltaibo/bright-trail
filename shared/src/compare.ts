import { z } from 'zod';
import type { Item } from './item';
import { choiceTextValue, itemAnswer, parseMixed } from './scene';

/**
 * What a compare scene asks about its `values`:
 * - `greatest` and `least`: the one farthest right or left on a number line, or the tallest or
 *   shortest cube tower.
 * - `middle`: the one in the middle once the three are in order.
 * - `closer`: which of the values `target` is closer to.
 * - `relation`: whether the first of two values is more than, less than, or the same as the
 *   second. With a `claim`, whether that relation is the claimed one, for yes-or-no items.
 */
export const COMPARE_ASKS = ['greatest', 'least', 'middle', 'closer', 'relation'] as const;
export type CompareAsk = (typeof COMPARE_ASKS)[number];

export const RELATIONS = ['more', 'less', 'same'] as const;
export type Relation = (typeof RELATIONS)[number];

/** Whole numbers up to this stand as cube towers. Anything else drops flags on a number line. */
export const TOWER_MAX = 20;

const DECIMAL = /^\d+(?:\.\d+)?$/;

/** Reads "12", "0.06", "3/8", or "1 1/2". Null for anything else. */
export function compareValue(text: string): number | null {
  const t = text.trim();
  return DECIMAL.test(t) ? Number(t) : parseMixed(t);
}

const ValueText = z
  .string()
  .trim()
  .refine((t) => compareValue(t) !== null, { message: 'not a number, decimal, or fraction' });

export const CompareSceneSchema = z
  .object({
    kind: z.literal('compare'),
    ask: z.enum(COMPARE_ASKS),
    /** The numbers as the item writes them, so "0.50" keeps its zero and "3/6" isn't reduced. */
    values: z.array(ValueText).min(2).max(4),
    /** The number a `closer` ask measures from. */
    target: ValueText.optional(),
    /** The relation a yes-or-no `relation` ask states, as in "Is 11/8 greater than 3/2?". */
    claim: z.enum(RELATIONS).optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const nums = s.values.map((v) => compareValue(v)!);
    if (s.ask === 'relation') {
      if (nums.length !== 2) issue('values', 'relation needs two values');
    } else if (new Set(nums).size !== nums.length) issue('values', 'values must differ');
    if (s.claim !== undefined && s.ask !== 'relation')
      issue('claim', `ask ${s.ask} takes no claim`);
    if (s.ask === 'middle' && nums.length !== 3) issue('values', 'middle needs three values');
    if (s.ask === 'closer') {
      if (s.target === undefined) issue('target', 'closer needs a target');
      else if (s.values.length !== 2) issue('values', 'closer needs two values');
      else {
        const [a, b] = nums.map((n) => Math.abs(n - compareValue(s.target!)!));
        if (Math.abs(a - b) < 1e-9) issue('target', 'the target is as close to both');
      }
    } else if (s.target !== undefined) issue('target', `ask ${s.ask} takes no target`);
  });
export type CompareScene = z.infer<typeof CompareSceneSchema>;

/** The values as numbers, in the scene's order. */
export function compareNumbers(s: CompareScene): number[] {
  return s.values.map((v) => compareValue(v)!);
}

const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** How the first value stands to the second. */
export function compareRelation(s: CompareScene): Relation {
  const [a, b] = compareNumbers(s);
  return sameNumber(a, b) ? 'same' : a > b ? 'more' : 'less';
}

/** What a `relation` ask answers: the relation, or whether it is the claimed one. */
export function relationAnswer(s: CompareScene): Relation | boolean {
  const r = compareRelation(s);
  return s.claim === undefined ? r : r === s.claim;
}

/**
 * Reads a choice like "the same", "less than 500", "bigger", "True", or "no" against `than`, the
 * value it measures from. Null when it is none of these, or names another value.
 */
export function relationWord(text: string, than: string): Relation | boolean | null {
  const t = text.trim().toLowerCase();
  if (t === 'yes' || t === 'true') return true;
  if (t === 'no' || t === 'false') return false;
  const m = /^(?:the )?(\w+)(?: amount)?(?: (?:than|as) (.+))?$/.exec(t);
  if (!m) return null;
  if (m[2] !== undefined) {
    const n = compareValue(m[2]);
    if (n === null || !sameNumber(n, compareValue(than)!)) return null;
  }
  if (/^(more|greater|bigger|larger)$/.test(m[1])) return 'more';
  if (/^(less|fewer|smaller)$/.test(m[1])) return 'less';
  if (/^(same|equal)$/.test(m[1])) return 'same';
  return null;
}

/** The index in `values` of the one the scene picks. A `relation` ask picks the first. */
export function compareWinner(s: CompareScene): number {
  const nums = compareNumbers(s);
  const best = (better: (a: number, b: number) => boolean) =>
    nums.reduce((w, n, i) => (better(n, nums[w]) ? i : w), 0);
  switch (s.ask) {
    case 'greatest':
      return best((a, b) => a > b);
    case 'least':
      return best((a, b) => a < b);
    case 'middle': {
      const sorted = [...nums].sort((a, b) => a - b);
      return nums.indexOf(sorted[1]);
    }
    case 'closer': {
      const t = compareValue(s.target!)!;
      return best((a, b) => Math.abs(a - t) < Math.abs(b - t));
    }
    case 'relation':
      return 0;
  }
}

/** How the app shows the scene: cube towers for whole numbers to 20, else flags on a line. */
export function compareView(s: CompareScene): 'towers' | 'line' {
  if (s.ask === 'closer') return 'line';
  const towers = compareNumbers(s).every((n) => Number.isInteger(n) && n >= 1 && n <= TOWER_MAX);
  return towers ? 'towers' : 'line';
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Why a `relation` scene can't play this tap item's word choices. */
function relationProblems(item: Item, scene: CompareScene): string[] {
  if (item.type !== 'tap') return ['a relation needs word choices'];
  const than = scene.values[1];
  const read = item.choices.map((c) => (c.kind === 'text' ? relationWord(c.text, than) : null));
  if (read.some((r) => r === null)) return ['a choice is not more, less, same, yes, or no'];
  const yesNo = read.some((r) => typeof r === 'boolean');
  if (yesNo !== (scene.claim !== undefined)) {
    return [yesNo ? 'yes-or-no choices need a claim' : 'a claim needs yes-or-no choices'];
  }
  const answer = read[item.choices.findIndex((c) => c.id === item.answerChoiceId)];
  const expected = relationAnswer(scene);
  return answer === expected
    ? []
    : [`the scene answers ${expected} but the item answers ${answer}`];
}

/** Why the scene can't play this item. Empty when it can. */
export function compareProblems(item: Item, scene: CompareScene): string[] {
  const problems: string[] = [];
  const relation = scene.ask === 'relation';
  if (relation) problems.push(...relationProblems(item, scene));
  else {
    const answer = itemAnswer(item);
    const shown = scene.values[compareWinner(scene)];
    if (typeof answer !== 'number') problems.push('the item answer is not a number');
    else if (!sameNumber(answer, compareValue(shown)!)) {
      problems.push(`the scene picks ${shown} but the item answers ${answer}`);
    }
  }
  const nums = compareNumbers(scene);
  // The stage replaces the item's picture, which would then go unseen. Towers count the same
  // things as a picture of one of a relation's two amounts.
  if ('visual' in item && item.visual) {
    const v = item.visual;
    const counted =
      relation && v.kind === 'objects' && compareView(scene) === 'towers' && nums.includes(v.count);
    if (!counted) problems.push(`the item has a ${v.kind} picture`);
  }

  const words = `${item.prompt} ${item.narration}`;
  const said = (v: string) => new RegExp(`(^|[^\\d./])${escape(v)}(?![\\d/]|\\.\\d)`).test(words);
  if (item.type === 'tap' && !relation) {
    // The stage shows the same numbers the choices do, no more and no fewer.
    const choices = item.choices.map((c) =>
      c.kind === 'number' ? c.value : c.kind === 'text' ? choiceTextValue(c.text) : null,
    );
    if (choices.some((v) => typeof v !== 'number')) problems.push('a choice is not a number');
    else if (
      choices.length !== nums.length ||
      !choices.every((v) => nums.some((n) => sameNumber(n, v as number)))
    ) {
      problems.push(`the choices are not the scene's values ${scene.values.join(', ')}`);
    }
  } else {
    for (const v of new Set(scene.values)) if (!said(v)) problems.push(`the item never says ${v}`);
  }
  if (scene.target !== undefined && !said(scene.target)) {
    problems.push(`the item never says ${scene.target}`);
  }
  return problems;
}
