import { describe, expect, it } from 'vitest';
import {
  CompareSceneSchema,
  compareProblems,
  compareValue,
  compareView,
  compareWinner,
  type CompareScene,
} from './compare';
import type { Item } from './item';

const scene = (s: Omit<CompareScene, 'kind'>): CompareScene =>
  CompareSceneSchema.parse({ kind: 'compare', ...s });

const base = { id: 'i', skillId: 's', difficulty: 1, why: 'w' } as const;
const tap = (narration: string, answer: number, ...others: (number | string)[]): Item => ({
  ...base,
  prompt: 'Which is greater?',
  narration,
  type: 'tap',
  choices: [answer, ...others].map((v, i) =>
    typeof v === 'number'
      ? { id: 'abcd'[i], kind: 'number' as const, value: v }
      : { id: 'abcd'[i], kind: 'text' as const, text: v },
  ),
  answerChoiceId: 'a',
});
const keypad = (narration: string, answer: number): Item => ({
  ...base,
  prompt: 'Type it',
  narration,
  type: 'keypad',
  answer,
});

describe('compareValue', () => {
  it('reads whole numbers, decimals, fractions, and mixed numbers', () => {
    expect(compareValue('12')).toBe(12);
    expect(compareValue('0.06')).toBe(0.06);
    expect(compareValue('3/8')).toBe(0.375);
    expect(compareValue('1 1/2')).toBe(1.5);
    expect(compareValue('six')).toBeNull();
  });
});

describe('CompareSceneSchema', () => {
  it('needs different values and the numbers each ask uses', () => {
    expect(() => scene({ ask: 'greatest', values: ['0.5', '0.50'] })).toThrow(/must differ/);
    expect(() => scene({ ask: 'middle', values: ['1', '2'] })).toThrow(/three values/);
    expect(() => scene({ ask: 'closer', values: ['100', '200'] })).toThrow(/needs a target/);
    expect(() => scene({ ask: 'closer', values: ['100', '200'], target: '150' })).toThrow(
      /as close to both/,
    );
    expect(() => scene({ ask: 'least', values: ['1', '2'], target: '3' })).toThrow(/no target/);
  });
});

describe('compareWinner', () => {
  it('picks by the ask', () => {
    const values = ['5/2', '9/5', '9/4', '10/6'];
    expect(compareWinner(scene({ ask: 'greatest', values }))).toBe(0);
    expect(compareWinner(scene({ ask: 'least', values }))).toBe(3);
    expect(compareWinner(scene({ ask: 'middle', values: ['18', '42', '27'] }))).toBe(2);
    expect(compareWinner(scene({ ask: 'closer', values: ['100', '200'], target: '190' }))).toBe(1);
  });
});

describe('compareView', () => {
  it('stands whole numbers to 20 as towers and puts the rest on a line', () => {
    expect(compareView(scene({ ask: 'greatest', values: ['12', '9'] }))).toBe('towers');
    expect(compareView(scene({ ask: 'greatest', values: ['28', '9'] }))).toBe('line');
    expect(compareView(scene({ ask: 'greatest', values: ['0.6', '0.06'] }))).toBe('line');
    expect(compareView(scene({ ask: 'closer', values: ['10', '20'], target: '12' }))).toBe('line');
  });
});

describe('compareProblems', () => {
  it('accepts a tap item whose choices are its values', () => {
    const item = tap('Which is greater, 3/8 or 5/8?', 0.625, '3/8');
    expect(compareProblems(item, scene({ ask: 'greatest', values: ['3/8', '5/8'] }))).toEqual([]);
  });

  it('refuses a scene whose pick differs from the answer', () => {
    const item = tap('Which is less, 8 or 2?', 2, 8);
    expect(compareProblems(item, scene({ ask: 'greatest', values: ['8', '2'] }))).toEqual([
      'the scene picks 8 but the item answers 2',
    ]);
  });

  it('refuses values that are not the choices', () => {
    const item = tap('Which is greater, 7 or 12?', 12, 7);
    expect(compareProblems(item, scene({ ask: 'greatest', values: ['12', '7', '3'] }))).toEqual([
      "the choices are not the scene's values 12, 7, 3",
    ]);
  });

  it('needs a keypad item to say each value', () => {
    const item = keypad('Type the number that is less, 41 or 36.', 36);
    expect(compareProblems(item, scene({ ask: 'least', values: ['41', '36'] }))).toEqual([]);
    expect(compareProblems(item, scene({ ask: 'least', values: ['41', '6'] }))).toEqual([
      'the scene picks 6 but the item answers 36',
      'the item never says 6',
    ]);
  });

  it('needs the item to say the target', () => {
    const item = tap('Is 190 closer to 100 or 200?', 200, 100);
    const ok = scene({ ask: 'closer', values: ['100', '200'], target: '190' });
    expect(compareProblems(item, ok)).toEqual([]);
    expect(compareProblems(item, { ...ok, target: '199' })).toEqual(['the item never says 199']);
  });

  it('leaves number-line items and pictures to their own screens', () => {
    const line = {
      ...base,
      prompt: 'p',
      narration: 'Move the frog to the greater number, 5 or 13.',
      type: 'number-line',
      min: 0,
      max: 20,
      step: 1,
      target: 13,
    } as Item;
    expect(compareProblems(line, scene({ ask: 'greatest', values: ['5', '13'] }))).toEqual([
      'number-line items keep their own screen',
    ]);
  });
});
