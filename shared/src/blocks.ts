import { z } from 'zod';
import type { Item } from './item';
import { itemAnswer } from './scene';
import { integerToWords } from './speech';

/**
 * What a blocks scene asks about the flats, rods, and cubes on its mat:
 * - `total`: the number they make. Ten of a kind trade up first, so 9 tens and 15 ones make 105.
 * - `count`: how many blocks of `place` there are, like the tens digit or a missing part.
 * - `worth`: what the digit in `place` is worth, like the 8 in 583.
 * - `make`: how many of `place` the number makes in all, so 150 makes 15 tens.
 * - `add`: the `second` number's blocks join the mat, so 25 + 6 trades 11 ones for a ten.
 * - `take`: the `second` number's blocks leave, breaking a bigger block when a place runs short.
 */
export const BLOCKS_ASKS = ['total', 'count', 'worth', 'make', 'add', 'take'] as const;
export type BlocksAsk = (typeof BLOCKS_ASKS)[number];

export const PLACES = ['hundreds', 'tens', 'ones'] as const;
export type Place = (typeof PLACES)[number];
export const PLACE_VALUE: Record<Place, number> = { hundreds: 100, tens: 10, ones: 1 };

/** Most rods or cubes a mat shows before trading, and most of `place` a make ask can break into. */
export const MAX_LOOSE = 20;
export const MAX_MADE = 40;

const DIGIT = z.number().int().min(0).max(9);
const SecondSchema = z.object({ hundreds: DIGIT, tens: DIGIT, ones: DIGIT });

export const BlocksSceneSchema = z
  .object({
    kind: z.literal('blocks'),
    ask: z.enum(BLOCKS_ASKS),
    hundreds: z.number().int().min(0).max(9),
    tens: z.number().int().min(0).max(MAX_LOOSE),
    ones: z.number().int().min(0).max(MAX_LOOSE),
    /** The place a count, worth, or make ask is about. */
    place: z.enum(PLACES).optional(),
    /** The number an add or take ask joins to the mat or takes from it, as its digits. */
    second: SecondSchema.optional(),
  })
  .superRefine((s, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    const value = blocksValue(s);
    if (value < 1 || value > 999) issue('ones', 'the blocks must make 1 to 999');
    if (s.ask === 'add' || s.ask === 'take') {
      if (s.place !== undefined) issue('place', `${s.ask} takes no place`);
      if (!isStandard(s)) issue('tens', `${s.ask} needs 9 or fewer of each block`);
      if (s.second === undefined) {
        issue('second', `${s.ask} needs a second number`);
        return;
      }
      const other = blocksValue(s.second);
      if (other < 1) issue('second', 'the second number must be at least 1');
      if (s.ask === 'add' && value + other > 999) issue('second', 'the sum must be 999 or less');
      if (s.ask === 'take' && other > value)
        issue('second', 'take needs a second number no bigger');
      return;
    }
    if (s.second !== undefined) issue('second', `${s.ask} takes no second number`);
    if (s.ask === 'total') {
      if (s.place !== undefined) issue('place', 'total takes no place');
      return;
    }
    if (s.place === undefined) {
      issue('place', `${s.ask} needs a place`);
      return;
    }
    if (s.ask === 'worth' && !isStandard(s)) issue('tens', 'worth needs 9 or fewer of each block');
    if (s.ask === 'make' && blocksAnswer(s) > MAX_MADE) {
      issue('place', `make breaks into more than ${MAX_MADE} blocks`);
    }
  });
export type BlocksScene = z.infer<typeof BlocksSceneSchema>;
type Mat = Pick<BlocksScene, Place>;

export function blocksValue(m: Mat): number {
  return m.hundreds * 100 + m.tens * 10 + m.ones;
}

/** True when no place has 10 or more blocks, so the counts are the number's digits. */
export function isStandard(m: Mat): boolean {
  return m.tens <= 9 && m.ones <= 9;
}

/** The same number with every ten of a kind traded up, as its digits. */
export function standardMat(m: Mat): Mat {
  const v = blocksValue(m);
  return { hundreds: Math.floor(v / 100), tens: Math.floor(v / 10) % 10, ones: v % 10 };
}

/** The number the scene's ask comes to. */
export function blocksAnswer(s: BlocksScene): number {
  const pv = PLACE_VALUE[s.place ?? 'ones'];
  switch (s.ask) {
    case 'total':
      return blocksValue(s);
    case 'count':
      return s[s.place!];
    case 'worth':
      return s[s.place!] * pv;
    case 'make':
      return Math.floor(blocksValue(s) / pv);
    case 'add':
      return blocksValue(s) + blocksValue(s.second!);
    case 'take':
      return blocksValue(s) - blocksValue(s.second!);
  }
}

const NUMBER_WORD =
  '(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)\\b';

const sameNumber = (a: number, b: number) => Math.abs(a - b) < 1e-9;

/** Why the scene can't play this item. Empty when it can. */
export function blocksProblems(item: Item, scene: BlocksScene): string[] {
  const problems: string[] = [];
  const answer = itemAnswer(item);
  const shown = blocksAnswer(scene);
  if (typeof answer !== 'number') problems.push('the item answer is not a number');
  else if (!sameNumber(answer, shown)) {
    problems.push(`the blocks come to ${shown} but the item answers ${answer}`);
  }
  // The stage replaces the item's picture, which would then go unseen.
  if ('visual' in item && item.visual) problems.push(`the item has a ${item.visual.kind} picture`);

  // A total ask shows the number as its answer. The others ask about numbers the item names.
  const words = `${item.prompt} ${item.narration}`.toLowerCase();
  const named = scene.ask === 'total' ? [] : [blocksValue(scene)];
  if (scene.second) named.push(blocksValue(scene.second));
  for (const value of named) {
    if (!says(words, value)) problems.push(`the item never says ${value}`);
  }
  return problems;
}

function says(words: string, value: number): boolean {
  const digits = new RegExp(`(^|[^\\d.])${value}(?![\\d]|\\.\\d)`).test(words);
  // "twenty" must not match inside "twenty-four", nor "one hundred" inside "one hundred six".
  const spelled = new RegExp(
    `(?<![-\\w])${integerToWords(String(value))}(?![-\\w]| (and )?${NUMBER_WORD})`,
  ).test(words);
  return digits || spelled;
}
