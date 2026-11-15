import { describe, expect, it } from 'vitest';
import {
  GridSceneSchema,
  gridAnswer,
  gridFills,
  gridProblems,
  gridValue,
  namesTarget,
  type GridScene,
} from './grid';
import type { Item } from './item';

const scene = (s: Omit<GridScene, 'kind'>): GridScene =>
  GridSceneSchema.parse({ kind: 'grid', ...s });

const base = { id: 'i', skillId: 's', difficulty: 1, prompt: 'p', why: 'w' } as const;
const tap = (narration: string, answer: number | string, ...others: (number | string)[]): Item => ({
  ...base,
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
  narration,
  type: 'keypad',
  answer,
});

describe('gridValue', () => {
  it('reads decimals, fractions, mixed numbers, and percents', () => {
    expect(gridValue('0.4')).toBe(0.4);
    expect(gridValue('.5')).toBe(0.5);
    expect(gridValue('7/10')).toBe(0.7);
    expect(gridValue('1 1/4')).toBe(1.25);
    expect(gridValue('30%')).toBe(0.3);
    expect(gridValue('half')).toBeNull();
  });
});

describe('GridSceneSchema', () => {
  it('fills a whole number of parts in up to 4 strips or 2 grids', () => {
    expect(gridFills(scene({ unit: 'tenths', ask: 'decimal', amount: '3 5/10' }))).toEqual([35]);
    expect(gridFills(scene({ unit: 'hundredths', ask: 'percent', amount: '3/5' }))).toEqual([60]);
    expect(() => scene({ unit: 'tenths', ask: 'decimal', amount: '0.25' })).toThrow(/whole number/);
    expect(() => scene({ unit: 'hundredths', ask: 'fraction', amount: '2/3' })).toThrow(/whole/);
    expect(() => scene({ unit: 'tenths', ask: 'decimal', amount: '4.5' })).toThrow(/4 wholes/);
    expect(() => scene({ unit: 'hundredths', ask: 'decimal', amount: '2.25' })).toThrow(/2 wholes/);
    expect(() => scene({ unit: 'tenths', ask: 'decimal', amount: '0' })).toThrow(/fills nothing/);
  });

  it('takes an other amount for a same ask only', () => {
    expect(() => scene({ unit: 'hundredths', ask: 'same', amount: '7/10' })).toThrow(/needs an/);
    expect(() =>
      scene({ unit: 'hundredths', ask: 'decimal', amount: '0.7', other: '0.07' }),
    ).toThrow(/no other/);
  });
});

describe('gridAnswer', () => {
  it('answers in the form the item takes', () => {
    const percent = scene({ unit: 'hundredths', ask: 'percent', amount: '0.25' });
    expect(gridAnswer(percent, { type: 'keypad' })).toBe(25);
    expect(gridAnswer(percent, { type: 'tap' })).toBe(0.25);
    const parts = scene({ unit: 'hundredths', ask: 'parts', amount: '0.3' });
    expect(gridAnswer(parts, { type: 'keypad' })).toBe(30);
    const same = scene({ unit: 'hundredths', ask: 'same', amount: '6/8', other: '9/12' });
    expect(gridAnswer(same, { type: 'tap' })).toBe(true);
  });
});

describe('gridProblems', () => {
  it('accepts reading the fill as a decimal, fraction, or percent', () => {
    const decimal = keypad('Type the decimal for 9 tenths.', 0.9);
    expect(
      gridProblems(decimal, scene({ unit: 'tenths', ask: 'decimal', amount: '9/10' })),
    ).toEqual([]);
    const fraction = tap('Which fraction is the same as 0.4?', '4/10', '1/10', '6/10');
    expect(
      gridProblems(fraction, scene({ unit: 'tenths', ask: 'fraction', amount: '0.4' })),
    ).toEqual([]);
    const percent = tap('What percent is equal to 1/2?', '50%', '25%', '75%');
    const half = scene({ unit: 'hundredths', ask: 'percent', amount: '1/2' });
    expect(gridProblems(percent, half)).toEqual([]);
    expect(gridProblems(keypad('What percent is equal to 3/5?', 60), half)).toEqual([
      'the scene answers 50 but the item answers 60',
    ]);
  });

  it('needs a parts count to name the parts', () => {
    const s = scene({ unit: 'hundredths', ask: 'parts', amount: '0.3' });
    expect(gridProblems(keypad('0.3 is the same as how many hundredths?', 30), s)).toEqual([]);
    expect(gridProblems(keypad('What is 0.3 times 100?', 30), s)).toEqual([
      'the item never counts hundredths',
    ]);
  });

  it('answers a same ask yes or no, and needs the item to say both amounts', () => {
    const item = tap('Is 7/10 the same amount as 0.07? Yes or no?', 'No', 'Yes');
    const s = scene({ unit: 'hundredths', ask: 'same', amount: '7/10', other: '0.07' });
    expect(gridProblems(item, s)).toEqual([]);
    expect(gridProblems(item, { ...s, other: '0.7' })).toEqual([
      'the scene answers yes but the item answers no',
      'the item never says 0.7',
    ]);
  });

  it('takes a ten-frame only when the strip fills the same tenths', () => {
    const picture = {
      ...keypad('Four dots are filled. Type the decimal.', 0.4),
      visual: { kind: 'ten-frame', filled: 4 },
    } as Item;
    const four = scene({ unit: 'tenths', ask: 'decimal', amount: '4/10' });
    expect(gridProblems(picture, four)).toEqual([]);
    expect(
      gridProblems(picture, scene({ unit: 'hundredths', ask: 'decimal', amount: '40/100' })),
    ).toEqual(['the scene does not fill 4 tenths like the ten-frame']);
    const objects = { ...picture, visual: { kind: 'objects', emoji: '🍎', count: 4 } } as Item;
    expect(gridProblems(objects, four)).toEqual(['the item has a objects picture']);
  });

  it('takes number-line items unless they name the point they land on', () => {
    const line = (prompt: string, target: number) =>
      ({
        ...base,
        prompt,
        narration: `Move the frog to ${prompt.slice(5)} on the number line.`,
        type: 'number-line',
        min: 0,
        max: 1,
        step: 0.1,
        target,
      }) as Item;
    const s = scene({ unit: 'tenths', ask: 'decimal', amount: '3/10' });
    expect(gridProblems(line('Find 3/10', 0.3), s)).toEqual([]);
    const placed = scene({ unit: 'tenths', ask: 'decimal', amount: '0.3' });
    expect(gridProblems(line('Find 0.3', 0.3), placed)).toEqual([
      'the item names the point it lands on',
    ]);
    expect(namesTarget(line('Find 10.35', 0.35))).toBe(false);
  });
});
