import { z } from 'zod';
import type { Item } from './item';
import { choiceTextValue, itemAnswer, type SceneAnswer } from './scene';

/**
 * What a fraction wall asks. `than` is the top strip. The lower strip is the one the child
 * builds, `amount`, or the picked choice.
 * - `fill`: the child fills a strip of `parts` pieces to end where `than` ends.
 * - `pass`: the fewest pieces of `parts` that reach past `than`.
 * - `more`, `less`, `same`: yes or no, is `amount` more than, less than, or the same as `than`.
 * - `relation`: the right choice says whether `amount` is less, more, or the same as `than`.
 * - `match`: the right choice is the one equal to `than`.
 */
export const WALL_ASKS = ['fill', 'pass', 'more', 'less', 'same', 'relation', 'match'] as const;
export type WallAsk = (typeof WALL_ASKS)[number];

/** Asks the child answers by building the lower strip, instead of on a keypad. */
export const WALL_BUILD_ASKS: readonly WallAsk[] = ['fill', 'pass'];
const YES_NO_ASKS: readonly WallAsk[] = ['more', 'less', 'same'];

/** Limits that keep every piece wide enough to see and drag on a 360-point phone. */
export const WALL_LIMITS = { parts: 12, wholes: 4, pieces: 24 } as const;

/** A fraction as strip pieces: `count` pieces of 1/`parts`. "1 1/2" is 3 halves. */
export type WallFraction = { parts: number; count: number; value: number };

const FRACTION = /^(?:(\d+)\s+)?(\d+)\/(\d+)$|^(\d+)$/;

/** Reads "3/8", "11/8", "2 1/3", or a whole number like "2". Null for anything else. */
export function wallFraction(text: string): WallFraction | null {
  const m = FRACTION.exec(text.trim());
  if (!m) return null;
  if (m[4] !== undefined) {
    const n = Number(m[4]);
    return { parts: 1, count: n, value: n };
  }
  const parts = Number(m[3]);
  if (parts === 0) return null;
  const count = Number(m[1] ?? 0) * parts + Number(m[2]);
  return { parts, count, value: count / parts };
}

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** How many wholes the wall needs to show every value. */
export function wallWholes(values: readonly number[]): number {
  return Math.max(1, ...values.map((v) => Math.ceil(v - 1e-9)));
}

const FractionText = z
  .string()
  .trim()
  .refine((t) => wallFraction(t) !== null, { message: 'not a fraction or whole number' });

export const WallSceneSchema = z
  .object({
    kind: z.literal('wall'),
    ask: z.enum(WALL_ASKS),
    /** The top strip's fraction, as the item writes it, like "1/2" or "2 1/3". */
    than: FractionText,
    /** For `more`, `less`, `same`, and `relation`: the lower strip's fraction. */
    amount: FractionText.optional(),
    /** For `fill` and `pass`: the pieces in each whole of the strip the child builds. */
    parts: z.number().int().min(1).max(WALL_LIMITS.parts).optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const build = WALL_BUILD_ASKS.includes(s.ask);
    const compares = YES_NO_ASKS.includes(s.ask) || s.ask === 'relation';
    if (build && s.parts === undefined) issue('parts', `ask ${s.ask} needs parts`);
    if (!build && s.parts !== undefined) issue('parts', `ask ${s.ask} takes no parts`);
    if (compares && s.amount === undefined) issue('amount', `ask ${s.ask} needs an amount`);
    if (!compares && s.amount !== undefined) issue('amount', `ask ${s.ask} takes no amount`);

    const than = wallFraction(s.than);
    const amount = s.amount === undefined ? undefined : wallFraction(s.amount);
    if (!than || amount === null) return;
    if (than.value <= 0) issue('than', `${s.than} fills nothing`);
    if (amount && amount.value <= 0) issue('amount', `${s.amount} fills nothing`);
    if (
      s.ask === 'fill' &&
      s.parts &&
      !near(than.value * s.parts, Math.round(than.value * s.parts))
    ) {
      issue('parts', `${s.than} is not a whole number of 1/${s.parts} pieces`);
    }
    const rows = [than, ...(amount ? [amount] : [])];
    for (const [i, r] of rows.entries()) {
      if (r.parts > WALL_LIMITS.parts) {
        issue(i === 0 ? 'than' : 'amount', `pieces of 1/${r.parts} are too thin`);
      }
    }
    const values = rows.map((r) => r.value);
    if (s.parts) values.push(buildCount(s.ask, than.value, s.parts) / s.parts);
    const wholes = wallWholes(values);
    if (wholes > WALL_LIMITS.wholes) issue('than', `the wall needs ${wholes} wholes`);
    for (const parts of [...rows.map((r) => r.parts), ...(s.parts ? [s.parts] : [])]) {
      if (parts * wholes > WALL_LIMITS.pieces) {
        issue('parts', `${wholes} wholes of 1/${parts} pieces are too many to tap`);
      }
    }
  });
export type WallScene = z.infer<typeof WallSceneSchema>;

function buildCount(ask: WallAsk, than: number, parts: number): number {
  const exact = than * parts;
  return ask === 'fill' ? Math.round(exact) : Math.floor(exact + 1e-9) + 1;
}

export type WallRelation = 'less' | 'more' | 'same';

/** How `a` compares to `b`. */
export function wallRelation(a: number, b: number): WallRelation {
  return near(a, b) ? 'same' : a < b ? 'less' : 'more';
}

const RELATION_WORDS: [WallRelation, RegExp][] = [
  ['less', /\b(less|smaller|fewer|lower|shorter)\b/i],
  ['more', /\b(more|greater|bigger|larger|longer|higher)\b/i],
  ['same', /\b(same|equal|equivalent)\b/i],
];

/** The one relation a choice's words name, like "less than 1/2". Null for none or several. */
export function wallRelationWord(text: string): WallRelation | null {
  const found = RELATION_WORDS.filter(([, word]) => word.test(text)).map(([r]) => r);
  return found.length === 1 ? found[0] : null;
}

/** The fractions the wall shows, in order: the top strip, then `amount` when it has one. */
export function wallRows(s: WallScene): WallFraction[] {
  const rows = [wallFraction(s.than)!];
  if (s.amount !== undefined) rows.push(wallFraction(s.amount)!);
  return rows;
}

/**
 * The answer the wall plays out: a piece count for a build, yes or no, the relation of `amount`
 * to `than`, or the value the matching choice must have.
 */
export function wallAnswer(s: WallScene): SceneAnswer | WallRelation {
  const [than, amount] = wallRows(s);
  switch (s.ask) {
    case 'fill':
    case 'pass':
      return buildCount(s.ask, than.value, s.parts!);
    case 'more':
      return amount.value > than.value && !near(amount.value, than.value);
    case 'less':
      return amount.value < than.value && !near(amount.value, than.value);
    case 'same':
      return near(amount.value, than.value);
    case 'relation':
      return wallRelation(amount.value, than.value);
    case 'match':
      return than.value;
  }
}

const ORDINALS: Record<number, string> = {
  2: 'halves?',
  3: 'thirds?',
  4: '(fourths?|quarters?)',
  5: 'fifths?',
  6: 'sixths?',
  7: 'sevenths?',
  8: 'eighths?',
  9: 'ninths?',
  10: 'tenths?',
  11: 'elevenths?',
  12: 'twelfths?',
};

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Why the wall can't play this item. Empty when it can. */
export function wallProblems(item: Item, scene: WallScene): string[] {
  if (item.type === 'number-line') return ['number-line items keep their own screen'];
  const problems: string[] = [];
  // The wall replaces the item's picture, which would then go unseen.
  if (item.visual) problems.push(`the item has a ${item.visual.kind} picture`);

  const expected = wallAnswer(scene);
  const build = WALL_BUILD_ASKS.includes(scene.ask);
  if (build && item.type !== 'keypad') problems.push(`ask ${scene.ask} builds a keypad answer`);
  if (!build && item.type !== 'tap') problems.push(`ask ${scene.ask} needs choices`);

  if (item.type === 'tap') {
    const texts = item.choices.map((c) =>
      c.kind === 'text' ? c.text : c.kind === 'number' ? String(c.value) : null,
    );
    const answerText = texts[item.choices.findIndex((c) => c.id === item.answerChoiceId)];
    if (texts.some((t) => t === null)) problems.push('a choice is a picture');
    else if (YES_NO_ASKS.includes(scene.ask)) {
      if (!texts.every((t) => typeof choiceTextValue(t!) === 'boolean')) {
        problems.push('the choices are not yes and no');
      } else if (itemAnswer(item) !== expected) {
        problems.push(`the wall answers ${expected ? 'yes' : 'no'} but the item does not`);
      }
    } else if (scene.ask === 'relation') {
      const relations = texts.map((t) => wallRelationWord(t!));
      if (relations.some((r) => r === null) || new Set(relations).size !== relations.length) {
        problems.push('the choices do not each name less, more, or the same');
      } else if (wallRelationWord(answerText!) !== expected) {
        problems.push(`${scene.amount} is ${expected} but the item answers ${answerText}`);
      }
    } else if (scene.ask === 'match') {
      const fractions = texts.map((t) => wallFraction(t!));
      if (fractions.some((f) => f === null)) problems.push('a choice is not a fraction');
      else {
        const values = fractions.map((f) => f!.value);
        const wholes = wallWholes([...values, expected as number]);
        if (wholes > WALL_LIMITS.wholes) problems.push(`the choices need ${wholes} wholes`);
        if (
          fractions.some(
            (f) => f!.parts > WALL_LIMITS.parts || f!.parts * wholes > WALL_LIMITS.pieces,
          )
        ) {
          problems.push('a choice has pieces too thin to show');
        }
        if (values.filter((v) => near(v, expected as number)).length !== 1) {
          problems.push(`not exactly one choice equals ${scene.than}`);
        } else if (!near(wallFraction(answerText!)!.value, expected as number)) {
          problems.push(`the item answers ${answerText}, not the choice equal to ${scene.than}`);
        }
      }
    }
  } else if (build) {
    const answer = itemAnswer(item);
    if (typeof answer !== 'number' || !near(answer, expected as number)) {
      problems.push(`the wall builds ${String(expected)} but the item answers ${String(answer)}`);
    }
  }

  // The strips show the fractions the item names, not ones the tagger worked out.
  const words = `${item.prompt} ${item.narration}`;
  const said = (v: string) => new RegExp(`(^|[^\\d./])${escape(v)}(?![\\d/]|\\.\\d)`).test(words);
  for (const v of [scene.than, ...(scene.amount === undefined ? [] : [scene.amount])]) {
    if (!said(v)) problems.push(`the item never says ${v}`);
  }
  if (scene.parts !== undefined) {
    const p = scene.parts;
    const named =
      p === 1
        ? /\bwholes?\b/i
        : new RegExp(
            `/${p}\\b|\\bdenominator (of )?${p}\\b|\\b${p} as the denominator\\b|\\b${ORDINALS[p]}\\b`,
            'i',
          );
    if (!named.test(words)) problems.push(`the item never names pieces of 1/${p}`);
  }
  return problems;
}
