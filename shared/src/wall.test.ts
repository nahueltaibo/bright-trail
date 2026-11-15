import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import {
  wallRelationWord,
  WallSceneSchema,
  wallAnswer,
  wallFraction,
  wallProblems,
  wallWholes,
  type WallScene,
} from './wall';

const scene = (s: Omit<WallScene, 'kind'>): WallScene =>
  WallSceneSchema.parse({ kind: 'wall', ...s });

const base = { id: 'i', skillId: 's', difficulty: 1, why: 'w' } as const;
const keypad = (prompt: string, narration: string, answer: number): Item => ({
  ...base,
  prompt,
  narration,
  type: 'keypad',
  answer,
});
const tap = (prompt: string, narration: string, answer: string, ...others: string[]): Item => ({
  ...base,
  prompt,
  narration,
  type: 'tap',
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});

describe('wallFraction', () => {
  it('reads fractions, mixed numbers, and wholes as pieces', () => {
    expect(wallFraction('3/8')).toEqual({ parts: 8, count: 3, value: 0.375 });
    expect(wallFraction('2 1/3')).toEqual({ parts: 3, count: 7, value: 7 / 3 });
    expect(wallFraction('11/8')?.count).toBe(11);
    expect(wallFraction('2')).toEqual({ parts: 1, count: 2, value: 2 });
    expect(wallFraction('0.5')).toBeNull();
    expect(wallFraction('1/0')).toBeNull();
  });

  it('needs a whole for every started one', () => {
    expect(wallWholes([0.5, 0.375])).toBe(1);
    expect(wallWholes([1])).toBe(1);
    expect(wallWholes([11 / 8, 1.5])).toBe(2);
  });
});

describe('WallSceneSchema', () => {
  it('builds with parts and compares with an amount', () => {
    expect(wallAnswer(scene({ ask: 'fill', than: '2/3', parts: 12 }))).toBe(8);
    expect(wallAnswer(scene({ ask: 'pass', than: '1/2', parts: 6 }))).toBe(4);
    expect(wallAnswer(scene({ ask: 'pass', than: '1/3', parts: 4 }))).toBe(2);
    expect(wallAnswer(scene({ ask: 'fill', than: '6/3', parts: 1 }))).toBe(2);
    expect(wallAnswer(scene({ ask: 'more', than: '3/2', amount: '11/8' }))).toBe(false);
    expect(wallAnswer(scene({ ask: 'same', than: '1/2', amount: '2/4' }))).toBe(true);
    expect(wallAnswer(scene({ ask: 'relation', than: '1/2', amount: '3/8' }))).toBe('less');
    expect(wallAnswer(scene({ ask: 'match', than: '5/4' }))).toBe(1.25);
  });

  it('asks for the fields each ask needs, and no others', () => {
    expect(() => scene({ ask: 'fill', than: '1/2' })).toThrow(/needs parts/);
    expect(() => scene({ ask: 'more', than: '1/2' })).toThrow(/needs an amount/);
    expect(() => scene({ ask: 'match', than: '1/2', parts: 4 })).toThrow(/takes no parts/);
    expect(() => scene({ ask: 'fill', than: '1/2', amount: '1/4', parts: 4 })).toThrow(
      /takes no amount/,
    );
  });

  it('keeps pieces wide enough to tap', () => {
    expect(() => scene({ ask: 'fill', than: '1/3', parts: 4 })).toThrow(/whole number/);
    expect(() => scene({ ask: 'more', than: '1/2', amount: '1/16' })).toThrow(/too thin/);
    expect(() => scene({ ask: 'fill', than: '8', parts: 4 })).toThrow(/8 wholes/);
    expect(() => scene({ ask: 'fill', than: '3', parts: 12 })).toThrow(/too many/);
    expect(() => scene({ ask: 'more', than: '0/4', amount: '1/4' })).toThrow(/fills nothing/);
  });
});

describe('wallRelationWord', () => {
  it('names one relation or none', () => {
    expect(wallRelationWord('less than 1/2')).toBe('less');
    expect(wallRelationWord('bigger')).toBe('more');
    expect(wallRelationWord('the same')).toBe('same');
    expect(wallRelationWord('Leo')).toBeNull();
    expect(wallRelationWord('more or less')).toBeNull();
  });
});

describe('wallProblems', () => {
  const half = keypad(
    '1/2 = ?/4',
    'The fraction 1/2 is equivalent to a fraction with 4 as the denominator. Type the missing numerator.',
    2,
  );

  it('fits a build whose answer and words match', () => {
    expect(wallProblems(half, scene({ ask: 'fill', than: '1/2', parts: 4 }))).toEqual([]);
    const past = keypad(
      '?/6 is greater than 1/2',
      'A fraction has a denominator of 6. What is the smallest whole number numerator that makes it greater than 1/2?',
      4,
    );
    expect(wallProblems(past, scene({ ask: 'pass', than: '1/2', parts: 6 }))).toEqual([]);
    const cups = keypad('6/3 = ? wholes', 'Dev has 6/3 of a cup. How many whole cups?', 2);
    expect(wallProblems(cups, scene({ ask: 'fill', than: '6/3', parts: 1 }))).toEqual([]);
  });

  it('refuses a build with the wrong answer or unnamed pieces', () => {
    expect(
      wallProblems({ ...half, answer: 3 } as Item, scene({ ask: 'fill', than: '1/2', parts: 4 })),
    ).toEqual(['the wall builds 2 but the item answers 3']);
    expect(wallProblems(half, scene({ ask: 'fill', than: '1/2', parts: 8 }))).toEqual([
      'the wall builds 4 but the item answers 2',
      'the item never names pieces of 1/8',
    ]);
    expect(wallProblems(half, scene({ ask: 'fill', than: '2/4', parts: 4 }))).toContain(
      'the item never says 2/4',
    );
  });

  it('checks yes-no and relation choices against the wall', () => {
    const greater = tap(
      '11/8 greater than 3/2?',
      'Is 11/8 greater than 3/2? Yes or no.',
      'No',
      'Yes',
    );
    expect(wallProblems(greater, scene({ ask: 'more', than: '3/2', amount: '11/8' }))).toEqual([]);
    expect(wallProblems(greater, scene({ ask: 'less', than: '3/2', amount: '11/8' }))).toEqual([
      'the wall answers yes but the item does not',
    ]);
    const less = tap(
      '3/8 and 1/2',
      'Is 3/8 less than 1/2 or more than 1/2?',
      'less than 1/2',
      'more than 1/2',
    );
    expect(wallProblems(less, scene({ ask: 'relation', than: '1/2', amount: '3/8' }))).toEqual([]);
    expect(wallProblems(less, scene({ ask: 'relation', than: '3/8', amount: '1/2' }))).toEqual([
      '1/2 is more but the item answers less than 1/2',
    ]);
    expect(wallProblems(less, scene({ ask: 'more', than: '1/2', amount: '3/8' }))).toEqual([
      'the choices are not yes and no',
    ]);
  });

  it('checks that one choice matches', () => {
    const mixed = tap(
      '5/4 as a mixed number',
      'Which mixed number equals 5/4: 1 1/4, 1 1/2, 2 1/4, or 1 3/4?',
      '1 1/4',
      '1 1/2',
      '2 1/4',
      '1 3/4',
    );
    expect(wallProblems(mixed, scene({ ask: 'match', than: '5/4' }))).toEqual([]);
    expect(wallProblems(mixed, scene({ ask: 'match', than: '1 1/2' }))).toContain(
      'the item answers 1 1/4, not the choice equal to 1 1/2',
    );
    const thin = tap('1/2 = ?', 'Which equals 1/2: 8/16 or 1/3?', '8/16', '1/3');
    expect(wallProblems(thin, scene({ ask: 'match', than: '1/2' }))).toContain(
      'a choice has pieces too thin to show',
    );
  });

  it('keeps number lines, pictures, and keypad compares off the wall', () => {
    const line = { ...base, prompt: 'p', narration: 'n', type: 'number-line' } as unknown as Item;
    expect(wallProblems(line, scene({ ask: 'fill', than: '1/2', parts: 4 }))).toEqual([
      'number-line items keep their own screen',
    ]);
    const picture = { ...half, visual: { kind: 'objects', emoji: '🍪', count: 2 } } as Item;
    expect(wallProblems(picture, scene({ ask: 'fill', than: '1/2', parts: 4 }))).toContain(
      'the item has a objects picture',
    );
    expect(wallProblems(half, scene({ ask: 'same', than: '1/2', amount: '2/4' }))).toContain(
      'ask same needs choices',
    );
  });
});
