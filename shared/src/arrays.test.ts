import { describe, expect, it } from 'vitest';
import {
  arrayAnswer,
  arrayParts,
  arrayProblems,
  ArraySceneSchema,
  type ArrayScene,
} from './arrays';
import type { Item } from './item';

const scene = (s: Omit<ArrayScene, 'kind'>): ArrayScene =>
  ArraySceneSchema.parse({ kind: 'arrays', ...s });

const base = { id: 'i', skillId: 's', difficulty: 1, why: 'w' } as const;
const keypad = (prompt: string, narration: string, answer: number): Item => ({
  ...base,
  prompt,
  narration,
  type: 'keypad',
  answer,
});
const tap = (prompt: string, narration: string, answer: number | string, ...others: string[]) =>
  ({
    ...base,
    prompt,
    narration,
    type: 'tap',
    choices: [answer, ...others].map((v, i) =>
      typeof v === 'number'
        ? { id: 'abcd'[i], kind: 'number' as const, value: v }
        : { id: 'abcd'[i], kind: 'text' as const, text: v },
    ),
    answerChoiceId: 'a',
  }) as Item;

describe('ArraySceneSchema', () => {
  it('refuses a turn without a find, a square turn, and a cut outside the array', () => {
    const bad = (s: object) => ArraySceneSchema.safeParse({ kind: 'arrays', ...s }).success;
    expect(bad({ ask: 'turn', rows: 3, columns: 5 })).toBe(false);
    expect(bad({ ask: 'turn', rows: 4, columns: 4, find: 'total' })).toBe(false);
    expect(
      bad({ ask: 'split', rows: 4, columns: 6, find: 'total', split: { by: 'columns', at: 6 } }),
    ).toBe(false);
    expect(
      bad({ ask: 'split', rows: 4, columns: 6, find: 'rows', split: { by: 'columns', at: 5 } }),
    ).toBe(false);
    expect(bad({ ask: 'total', rows: 4, columns: 6, find: 'total' })).toBe(false);
    expect(bad({ ask: 'total', rows: 11, columns: 6 })).toBe(false);
    expect(bad({ ask: 'total', rows: 10, columns: 10 })).toBe(true);
  });
});

describe('arrayAnswer', () => {
  it('finds the total, the rows, or the size of a row', () => {
    expect(arrayAnswer(scene({ ask: 'total', rows: 3, columns: 4 }))).toBe(12);
    expect(arrayAnswer(scene({ ask: 'rows', rows: 3, columns: 4 }))).toBe(3);
    expect(arrayAnswer(scene({ ask: 'columns', rows: 3, columns: 4 }))).toBe(4);
  });

  it('finds what a turn or a split asks for', () => {
    expect(arrayAnswer(scene({ ask: 'turn', rows: 3, columns: 5, find: 'rows' }))).toBe(3);
    expect(arrayAnswer(scene({ ask: 'turn', rows: 6, columns: 2, find: 'total' }))).toBe(12);
    const cut = { ask: 'split', rows: 4, columns: 6, split: { by: 'columns', at: 5 } } as const;
    expect(arrayAnswer(scene({ ...cut, find: 'second' }))).toBe(1);
    expect(arrayAnswer(scene({ ...cut, find: 'first' }))).toBe(5);
    expect(arrayAnswer(scene({ ...cut, find: 'total' }))).toBe(24);
    expect(arrayParts(scene({ ...cut, find: 'total' }))).toEqual([
      { rows: 4, columns: 5 },
      { rows: 4, columns: 1 },
    ]);
  });
});

describe('arrayProblems', () => {
  it('passes an item that says the numbers the child needs', () => {
    const item = keypad(
      '12 ÷ 4 = ?',
      'An array has 12 dots. There are 4 in each row. How many rows?',
      3,
    );
    expect(arrayProblems(item, scene({ ask: 'rows', rows: 3, columns: 4 }))).toEqual([]);
    const swap = tap('3 × 5 = 5 × ?', '3 × 5 is the same as 5 × what number?', 3, '5', '15');
    expect(arrayProblems(swap, scene({ ask: 'turn', rows: 3, columns: 5, find: 'rows' }))).toEqual(
      [],
    );
    const split = keypad('8 × 7 = ?', 'Lena uses 8 × 5 = 40 and 8 × 2 = 16. What is 8 × 7?', 56);
    const cut = scene({
      ask: 'split',
      rows: 8,
      columns: 7,
      find: 'total',
      split: { by: 'columns', at: 5 },
    });
    expect(arrayProblems(split, cut)).toEqual([]);
  });

  it('reports a wrong answer, a missing number, text choices, and a number line', () => {
    const item = keypad('What is 4 × 3?', 'What is 4 × 3?', 12);
    expect(arrayProblems(item, scene({ ask: 'total', rows: 4, columns: 4 }))).toEqual([
      'the scene finds 16 but the item answers 12',
    ]);
    expect(arrayProblems(item, scene({ ask: 'total', rows: 6, columns: 2 }))).toEqual([
      'the item never says 6',
      'the item never says 2',
    ]);
    const fact = tap('4 rows of 8', 'Which fact? 4 + 8 or 4 × 8?', '4 × 8', '4 + 8');
    expect(arrayProblems(fact, scene({ ask: 'total', rows: 4, columns: 8 }))).toContain(
      'a choice is not a number',
    );
    const line: Item = {
      ...base,
      prompt: '4 × 2 = ?',
      narration: 'Move the frog to 4 × 2.',
      type: 'number-line',
      min: 0,
      max: 10,
      step: 1,
      target: 8,
    };
    expect(arrayProblems(line, scene({ ask: 'total', rows: 4, columns: 2 }))).toEqual([
      'number-line items keep their own screen',
    ]);
  });

  it('reads number words, and does not read 1 inside 10', () => {
    const row = keypad(
      '6 × 8 = ?',
      'Zoe knows 5 × 8 is 40. She adds one more row of 8. What is 6 × 8?',
      48,
    );
    const cut = scene({
      ask: 'split',
      rows: 6,
      columns: 8,
      find: 'total',
      split: { by: 'rows', at: 5 },
    });
    expect(arrayProblems(row, cut)).toEqual([]);
    const item = keypad('10 × 7 = ?', 'Ten rows of 7.', 70);
    expect(arrayProblems(item, scene({ ask: 'total', rows: 10, columns: 7 }))).toEqual([]);
    const one = keypad('10 × 7 = ?', 'Some rows of 7.', 7);
    expect(arrayProblems(one, scene({ ask: 'total', rows: 1, columns: 7 }))).toContain(
      'the item never says 1',
    );
  });
});
