import type { Choice, Item, Visual } from '@bright-trail/shared';
import { evaluate, literalsOf, type ExprContext, type Value } from './expr';
import { numbersMentioned, parseNumberText } from './numbers';
import { Rational } from './rational';
import type { GenCheck } from './schema';

/**
 * - `solved`: code recomputed the answer from numbers the child sees or hears.
 * - `linked`: code recomputed the answer, but the model declared how a choice or number maps to
 *   the question, so the second model must confirm that link.
 * - `unchecked`: code can't check it. Only the second model does.
 */
export type CheckLevel = 'solved' | 'linked' | 'unchecked';

export interface SolveResult {
  level: CheckLevel;
  problems: string[];
}

/** Literals any check may use without the question saying them, e.g. `% 2` or `/ 100`. */
const FREE_LITERALS = [0n, 1n, 2n, 10n, 100n].map((n) => new Rational(n));

/** The second pick must be this share of the gap further away, so "closer to 5 or 10?" has a clear answer. */
export const NEAREST_MARGIN = 0.2;

function visualCount(visual: Visual | undefined): number | undefined {
  if (!visual) return undefined;
  if (visual.kind === 'objects') return visual.count;
  if (visual.kind === 'ten-frame') return visual.filled;
  if (visual.kind === 'fraction') return visual.shaded;
  return undefined;
}

/** The amount a fraction picture shows, e.g. 3 of 4 parts shaded is 3/4. */
function fractionOf(visual: Visual | undefined): Rational | undefined {
  if (visual?.kind !== 'fraction') return undefined;
  return new Rational(BigInt(visual.shaded), BigInt(visual.parts));
}

function pictureContext(visual: Visual | undefined): ExprContext {
  return {
    count: visualCount(visual),
    ...(visual?.kind === 'fraction' ? { parts: visual.parts, shaded: visual.shaded } : {}),
  };
}

function intrinsicValues(choice: Choice): Rational[] | null {
  if (choice.kind === 'number') return [Rational.of(choice.value)];
  if (choice.kind === 'text') return parseNumberText(choice.text);
  const fraction = fractionOf(choice.visual);
  if (fraction) return [fraction];
  const count = visualCount(choice.visual);
  return count === undefined ? null : [Rational.of(count)];
}

function asNumber(v: Value, what: string): Rational {
  if (typeof v === 'boolean') throw new Error(`${what} is true or false, not a number`);
  return v;
}

function questionNumbers(item: Item): Rational[] {
  const texts = [item.narration, item.prompt];
  const found = texts.flatMap(numbersMentioned);
  const visual = 'visual' in item ? item.visual : undefined;
  const count = visualCount(visual);
  if (count !== undefined) found.push(Rational.of(count));
  if (visual?.kind === 'fraction') found.push(Rational.of(visual.parts), fractionOf(visual)!);
  if (item.type === 'number-line') found.push(Rational.of(item.min), Rational.of(item.max));
  return found;
}

function unmentioned(exprs: string[], known: Rational[]): string[] {
  const missing = new Set<string>();
  for (const expr of exprs) {
    for (const literal of literalsOf(expr)) {
      if (![...known, ...FREE_LITERALS].some((k) => k.eq(literal))) missing.add(literal.toString());
    }
  }
  return [...missing];
}

const fmt = (r: Rational) => {
  const n = r.toNumber();
  return Number.isInteger(n) ? String(n) : r.toString();
};

/**
 * With a fraction picture, a number that the question doesn't say can only come from the
 * picture, so it must be one the picture shows. Otherwise the picture and answer disagree.
 */
function pictureMismatch(item: Item, exprs: string[]): string[] {
  const visual = 'visual' in item ? item.visual : undefined;
  if (visual?.kind !== 'fraction') return [];
  const missing = unmentioned(exprs, questionNumbers(item));
  if (missing.length === 0) return [];
  return [
    `check uses ${missing.join(', ')}, which the question doesn't say and the picture doesn't show (${visual.shaded} of ${visual.parts} parts shaded). Read the picture with shaded and parts, or fix the picture`,
  ];
}

/** Recomputes an item's answer from its check. Problems mean the item is wrong or unplayable. */
export function solveItem(item: Item, check: GenCheck): SolveResult {
  const problems: string[] = [];
  const visual = 'visual' in item ? item.visual : undefined;
  const ctx = pictureContext(visual);
  const fail = (message: string): SolveResult => ({ level: 'unchecked', problems: [message] });

  if (check.rule === 'none') {
    if (!check.note.trim()) return fail('rule "none" needs a note saying why code cannot check it');
    return { level: 'unchecked', problems };
  }

  let linked = false;
  const run = (expr: string, what: string): Value | null => {
    try {
      return evaluate(expr, ctx);
    } catch (error) {
      problems.push(`${what} "${expr}" does not evaluate: ${(error as Error).message}`);
      return null;
    }
  };

  if (item.type === 'keypad' || item.type === 'number-line') {
    if (check.rule !== 'equals') return fail(`${item.type} items need rule "equals" or "none"`);
    const value = run(check.expr, 'check.expr');
    if (value === null) return { level: 'unchecked', problems };
    let expected: Rational;
    try {
      expected = asNumber(value, 'check.expr');
    } catch (error) {
      return fail((error as Error).message);
    }
    const given = item.type === 'keypad' ? item.answer : item.target;
    const field = item.type === 'keypad' ? 'answer' : 'target';
    if (!Rational.of(given).eq(expected)) {
      problems.push(`${field} is ${given} but ${check.expr} = ${fmt(expected)}`);
    }
    problems.push(...pictureMismatch(item, [check.expr]));
    linked = unmentioned([check.expr], questionNumbers(item)).length > 0;
    return { level: linked ? 'linked' : 'solved', problems };
  }

  // Tap: work out what each choice is worth, then apply the rule.
  const declared = new Map(check.choices.map((c) => [c.id, c.expr.trim()]));
  for (const id of declared.keys()) {
    if (!item.choices.some((c) => c.id === id)) problems.push(`check names unknown choice ${id}`);
  }

  if (check.rule === 'true') {
    const truths: string[] = [];
    for (const choice of item.choices) {
      const expr = declared.get(choice.id);
      if (!expr) {
        problems.push(`choice ${choice.id} needs a statement for rule "true"`);
        continue;
      }
      const value = run(expr, `choice ${choice.id}`);
      if (value === null) continue;
      if (typeof value !== 'boolean') {
        problems.push(`choice ${choice.id} statement "${expr}" is a number, not true or false`);
      } else if (value) truths.push(choice.id);
    }
    if (problems.length === 0) {
      if (truths.length !== 1) {
        problems.push(
          `${truths.length} choices are true (${truths.join(', ') || 'none'}), need exactly 1`,
        );
      } else if (truths[0] !== item.answerChoiceId) {
        problems.push(
          `choice ${truths[0]} is the true one, but the answer is ${item.answerChoiceId}`,
        );
      }
    }
    // Code can't tell that the label "even" means `14 % 2 == 0`, so the reviewer confirms it.
    return { level: 'linked', problems };
  }

  const values = new Map<string, Rational[]>();
  for (const choice of item.choices) {
    const intrinsic = intrinsicValues(choice);
    const expr = declared.get(choice.id);
    if (expr) {
      const value = run(expr, `choice ${choice.id}`);
      if (value === null) continue;
      if (typeof value === 'boolean') {
        problems.push(`choice ${choice.id} check "${expr}" is true or false, not a number`);
        continue;
      }
      if (intrinsic && !intrinsic.some((v) => v.eq(value))) {
        problems.push(
          `choice ${choice.id} shows ${fmt(intrinsic[0])} but its check says ${fmt(value)}`,
        );
        continue;
      }
      if (!intrinsic) linked = true;
      values.set(choice.id, [value]);
    } else if (intrinsic) {
      values.set(choice.id, intrinsic);
    } else {
      problems.push(`choice ${choice.id} has no number value and no check expression`);
    }
  }
  if (problems.length > 0) return { level: 'unchecked', problems };

  const entries = item.choices.map((c) => ({ id: c.id, values: values.get(c.id)! }));
  if (check.rule === 'greatest' || check.rule === 'least') {
    const sign = check.rule === 'greatest' ? 1 : -1;
    const sorted = [...entries].sort((a, b) => sign * b.values[0].cmp(a.values[0]));
    if (sorted.length > 1 && sorted[0].values[0].eq(sorted[1].values[0])) {
      problems.push(`choices ${sorted[0].id} and ${sorted[1].id} tie for ${check.rule}`);
    } else if (sorted[0].id !== item.answerChoiceId) {
      problems.push(
        `choice ${sorted[0].id} is the ${check.rule}, but the answer is ${item.answerChoiceId}`,
      );
    }
    return { level: linked ? 'linked' : 'solved', problems };
  }

  const targetValue = run(check.expr, 'check.expr');
  if (targetValue === null) return { level: 'unchecked', problems };
  let target: Rational;
  try {
    target = asNumber(targetValue, 'check.expr');
  } catch (error) {
    return fail((error as Error).message);
  }
  if (unmentioned([check.expr], questionNumbers(item)).length > 0) linked = true;
  problems.push(...pictureMismatch(item, [check.expr]));

  if (check.rule === 'equals') {
    const matches = entries.filter((e) => e.values.some((v) => v.eq(target))).map((e) => e.id);
    if (matches.length === 0) problems.push(`no choice equals ${fmt(target)}`);
    else if (matches.length > 1)
      problems.push(`choices ${matches.join(', ')} all equal ${fmt(target)}`);
    else if (matches[0] !== item.answerChoiceId) {
      problems.push(
        `choice ${matches[0]} equals ${fmt(target)}, but the answer is ${item.answerChoiceId}`,
      );
    }
    return { level: linked ? 'linked' : 'solved', problems };
  }

  // nearest: range-graded. The answer is right when the true amount is closest to it.
  const ranked = entries
    .map((e) => ({ id: e.id, value: e.values[0], distance: e.values[0].sub(target).abs() }))
    .sort((a, b) => a.distance.cmp(b.distance));
  const [best, next] = ranked;
  if (best.id !== item.answerChoiceId) {
    problems.push(
      `${fmt(target)} is closest to choice ${best.id}, but the answer is ${item.answerChoiceId}`,
    );
  } else if (next) {
    const gap = best.value.sub(next.value).abs();
    const lead = next.distance.sub(best.distance);
    if (lead.cmp(gap.mul(Rational.parse(String(NEAREST_MARGIN))!)) < 0) {
      problems.push(
        `${fmt(target)} is too close to halfway between ${fmt(best.value)} and ${fmt(next.value)} to grade`,
      );
    }
  }
  return { level: linked ? 'linked' : 'solved', problems };
}
