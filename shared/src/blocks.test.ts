import { describe, expect, it } from 'vitest';
import {
  BlocksSceneSchema,
  blocksAnswer,
  blocksProblems,
  standardMat,
  type BlocksScene,
} from './blocks';
import type { Item } from './item';

const scene = (s: Partial<Omit<BlocksScene, 'kind'>> & Pick<BlocksScene, 'ask'>): BlocksScene =>
  BlocksSceneSchema.parse({ kind: 'blocks', hundreds: 0, tens: 0, ones: 0, ...s });

const base = { id: 'i', skillId: 's', difficulty: 1, why: 'w', prompt: 'p' } as const;
const keypad = (narration: string, answer: number): Item => ({
  ...base,
  narration,
  type: 'keypad',
  answer,
});
const tap = (narration: string, answer: number, ...others: number[]): Item => ({
  ...base,
  narration,
  type: 'tap',
  choices: [answer, ...others].map((value, i) => ({
    id: 'abcd'[i],
    kind: 'number' as const,
    value,
  })),
  answerChoiceId: 'a',
});

describe('BlocksSceneSchema', () => {
  it('needs 1 to 999, a place for every ask but total, and digits for worth', () => {
    expect(() => scene({ ask: 'total' })).toThrow(/1 to 999/);
    expect(() => scene({ ask: 'total', hundreds: 9, tens: 9, ones: 10 })).toThrow(/1 to 999/);
    expect(() => scene({ ask: 'count', tens: 4 })).toThrow(/needs a place/);
    expect(() => scene({ ask: 'total', ones: 3, place: 'ones' })).toThrow(/no place/);
    expect(() => scene({ ask: 'worth', tens: 12, place: 'tens' })).toThrow(/9 or fewer/);
    expect(() => scene({ ask: 'make', hundreds: 5, place: 'tens' })).toThrow(/more than 40/);
  });
});

describe('blocksAnswer', () => {
  it('works out each ask', () => {
    expect(blocksAnswer(scene({ ask: 'total', tens: 9, ones: 15 }))).toBe(105);
    expect(
      blocksAnswer(scene({ ask: 'count', hundreds: 6, tens: 3, ones: 9, place: 'tens' })),
    ).toBe(3);
    expect(
      blocksAnswer(scene({ ask: 'worth', hundreds: 5, tens: 8, ones: 3, place: 'tens' })),
    ).toBe(80);
    expect(blocksAnswer(scene({ ask: 'make', hundreds: 1, tens: 5, place: 'tens' }))).toBe(15);
  });

  it('trades ten of a kind up for the standard digits', () => {
    expect(standardMat({ hundreds: 2, tens: 14, ones: 3 })).toEqual({
      hundreds: 3,
      tens: 4,
      ones: 3,
    });
  });
});

describe('blocksProblems', () => {
  it('accepts a total that matches the answer', () => {
    const item = keypad('Mia has 9 tens and 15 ones. What number is that?', 105);
    expect(blocksProblems(item, scene({ ask: 'total', tens: 9, ones: 15 }))).toEqual([]);
    expect(blocksProblems(item, scene({ ask: 'total', tens: 9, ones: 5 }))).toEqual([
      'the blocks come to 95 but the item answers 105',
    ]);
  });

  it('needs a count, worth, or make item to name its number, in digits or words', () => {
    const worth = tap('In the number 583, what is the 8 worth? Is it 8, 80, or 800?', 80, 8, 800);
    const mat = { hundreds: 5, tens: 8, ones: 3 };
    expect(blocksProblems(worth, scene({ ask: 'worth', ...mat, place: 'tens' }))).toEqual([]);
    expect(blocksProblems(worth, scene({ ask: 'worth', ...mat, ones: 4, place: 'tens' }))).toEqual([
      'the item never says 584',
    ]);
    const hundred = tap('How many tens make one hundred? Is it 5, 10, or 20?', 10, 5, 20);
    expect(blocksProblems(hundred, scene({ ask: 'make', hundreds: 1, place: 'tens' }))).toEqual([]);
  });

  it('does not read a number inside a longer one', () => {
    const item = keypad('Twenty-four is 20 and what?', 4);
    expect(blocksProblems(item, scene({ ask: 'count', tens: 2, ones: 4, place: 'ones' }))).toEqual(
      [],
    );
    const long = keypad('Type one hundred six. How many hundreds?', 1);
    expect(blocksProblems(long, scene({ ask: 'count', hundreds: 1, place: 'hundreds' }))).toEqual([
      'the item never says 100',
    ]);
  });

  it('leaves number-line items and pictures to their own screens', () => {
    const line = {
      ...base,
      narration: 'Move the frog to 3 tens and 5 ones.',
      type: 'number-line',
      min: 0,
      max: 50,
      step: 1,
      target: 35,
    } as Item;
    expect(blocksProblems(line, scene({ ask: 'total', tens: 3, ones: 5 }))).toEqual([
      'number-line items keep their own screen',
    ]);
  });
});
