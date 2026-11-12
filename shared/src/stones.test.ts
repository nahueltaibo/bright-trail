import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import {
  StonesSceneSchema,
  stoneNumbers,
  stoneStep,
  stepText,
  stonesProblems,
  type StonesScene,
} from './stones';

const scene = (stones: string[], missing: number): StonesScene =>
  StonesSceneSchema.parse({ kind: 'stones', stones, missing });

const base = { id: 'i', skillId: 's', difficulty: 1, why: 'w' } as const;
const tap = (
  prompt: string,
  narration: string,
  answer: number | string,
  ...others: (number | string)[]
): Item => ({
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
});
const keypad = (prompt: string, narration: string, answer: number): Item => ({
  ...base,
  prompt,
  narration,
  type: 'keypad',
  answer,
});

describe('StonesSceneSchema', () => {
  it('needs a missing stone in the row and one step between stones', () => {
    expect(() => scene(['2', '4', '6'], 3)).toThrow(/past the last stone/);
    expect(() => scene(['2', '4', '7'], 2)).toThrow(/same step/);
    expect(() => scene(['3', '3'], 1)).toThrow(/must change/);
    expect(() => scene(['2', 'six'], 1)).toThrow(/not a number/);
    expect(() => scene(['1', '2', '3', '4', '5', '6', '7', '8', '9'], 8)).toThrow();
  });

  it('counts up, down, and by fractions', () => {
    expect(stoneStep(scene(['2', '4', '6', '8'], 3))).toBe(2);
    expect(stoneStep(scene(['5', '4'], 1))).toBe(-1);
    const thirds = scene(['1/3', '2/3', '3/3'], 2);
    expect(stoneNumbers(thirds)[2]).toBeCloseTo(1);
    expect(stepText(thirds)).toBe('1/3');
    expect(stepText(scene(['50', '40', '30'], 2))).toBe('10');
  });
});

describe('stonesProblems', () => {
  it('fits a next-number item and a missing middle number', () => {
    const next = tap(
      '2, 4, 6, ?',
      'Count by 2s. 2, 4, 6. What comes next? Is it 7, 8, or 9?',
      8,
      7,
      9,
    );
    expect(stonesProblems(next, scene(['2', '4', '6', '8'], 3))).toEqual([]);
    const middle = keypad('35, 40, ?, 50', 'Count by 5s. What is the missing number?', 45);
    expect(stonesProblems(middle, scene(['35', '40', '45', '50'], 2))).toEqual([]);
  });

  it('reads fraction choices as the item writes them', () => {
    const item = tap('1/3, 2/3, ...', 'Count by thirds. What comes next?', '3/3', '4/3', '2/4');
    expect(stonesProblems(item, scene(['1/3', '2/3', '3/3'], 2))).toEqual([]);
  });

  it('rejects a wrong missing stone, numbers the item never says, and pictures', () => {
    const item = keypad('12, 14, 16, ?', 'Count by 2s. What comes next?', 18);
    expect(stonesProblems(item, scene(['12', '14', '16', '18', '20'], 4))).toEqual([
      'the missing stone is 20 but the item answers 18',
      'the item never says 18',
    ]);
    expect(stonesProblems(item, scene(['10', '12', '14', '16', '18'], 4))).toEqual([
      'the item never says 10',
    ]);
    const counted = {
      ...keypad('How many?', 'Count 5, 10, 15.', 20),
      visual: { kind: 'objects' },
    } as Item;
    expect(stonesProblems(counted, scene(['5', '10', '15', '20'], 3))).toEqual([
      'the item has a objects picture',
    ]);
  });

  it('leaves number-line items on their own screen', () => {
    const line: Item = {
      ...base,
      prompt: '13, 14, ?',
      narration: 'Count 13, 14. Hop Pip to the next number.',
      type: 'number-line',
      min: 0,
      max: 20,
      step: 1,
      target: 15,
    };
    expect(stonesProblems(line, scene(['13', '14', '15'], 2))).toContain(
      'number-line items keep their own screen',
    );
  });
});
