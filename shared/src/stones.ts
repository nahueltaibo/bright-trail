import { z } from 'zod';
import { compareValue } from './compare';
import type { Item } from './item';
import { formatAmount, itemAnswer } from './scene';

/** Most stones in a row. More get too small to read on a phone. */
export const MAX_STONES = 8;

const ValueText = z
  .string()
  .trim()
  .refine((t) => compareValue(t) !== null, { message: 'not a number, decimal, or fraction' });

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

export const StonesSceneSchema = z
  .object({
    kind: z.literal('stones'),
    /** Each stone's number in hop order, as the item writes it, so "3/3" isn't read as 1. */
    stones: z.array(ValueText).min(2).max(MAX_STONES),
    /** The stone with no number, which the child finds. */
    missing: z.number().int().min(0),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (s.missing >= s.stones.length) issue('missing', 'missing is past the last stone');
    const nums = s.stones.map((v) => compareValue(v));
    if (nums.some((n) => n === null)) return;
    const step = nums[1]! - nums[0]!;
    if (near(step, 0)) issue('stones', 'the stones must change');
    else if (nums.some((n, i) => i > 0 && !near(n! - nums[i - 1]!, step))) {
      issue('stones', 'the stones must change by the same step');
    }
  });
export type StonesScene = z.infer<typeof StonesSceneSchema>;

/** The stones as numbers, in hop order. */
export function stoneNumbers(s: StonesScene): number[] {
  return s.stones.map((v) => compareValue(v)!);
}

/** How much each hop adds. Negative when the stones count down. */
export function stoneStep(s: StonesScene): number {
  const [a, b] = stoneNumbers(s);
  return Number((b - a).toFixed(9));
}

/** A hop's size without its sign, written like the stones: 1/3 among fractions, 0.5 among decimals. */
export function stepText(s: StonesScene): string {
  const size = Math.abs(stoneStep(s));
  return s.stones.some((v) => v.includes('/')) ? formatAmount(size) : String(size);
}

const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');

/** Why the scene can't play this item. Empty when it can. */
export function stonesProblems(item: Item, scene: StonesScene): string[] {
  const problems: string[] = [];
  const answer = itemAnswer(item);
  const hidden = scene.stones[scene.missing];
  if (typeof answer !== 'number') problems.push('the item answer is not a number');
  else if (!near(answer, compareValue(hidden)!)) {
    problems.push(`the missing stone is ${hidden} but the item answers ${answer}`);
  }
  if (item.type === 'number-line') problems.push('number-line items keep their own screen');
  // The stage replaces the item's picture, which would then go unseen.
  if ('visual' in item && item.visual) problems.push(`the item has a ${item.visual.kind} picture`);

  // Every number on a stone comes from the item, so the scene can't invent a pattern.
  const words = `${item.prompt} ${item.narration}`;
  const said = (v: string) => new RegExp(`(^|[^\\d./])${escape(v)}(?![\\d/]|\\.\\d)`).test(words);
  scene.stones.forEach((v, i) => {
    if (i !== scene.missing && !said(v)) problems.push(`the item never says ${v}`);
  });
  return problems;
}
