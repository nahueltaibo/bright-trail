import { describe, expect, it } from 'vitest';
import {
  CompareSceneSchema,
  compareProblems,
  compareValue,
  compareView,
  compareWinner,
  relationAnswer,
  relationWord,
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

  it('takes two values for a relation, equal ones too, and a claim only there', () => {
    expect(scene({ ask: 'relation', values: ['4', '4'] }).values).toEqual(['4', '4']);
    expect(scene({ ask: 'relation', values: ['6.3', '6.30'], claim: 'same' }).claim).toBe('same');
    expect(() => scene({ ask: 'relation', values: ['1', '2', '3'] })).toThrow(/two values/);
    expect(() => scene({ ask: 'least', values: ['1', '2'], claim: 'less' })).toThrow(/no claim/);
    const bigger = { kind: 'compare', ask: 'relation', values: ['1', '2'], claim: 'bigger' };
    expect(CompareSceneSchema.safeParse(bigger).success).toBe(false);
  });
});

describe('relationAnswer', () => {
  it('says how the first value stands to the second, or whether the claim holds', () => {
    const answer = (s: Omit<CompareScene, 'kind'>) => relationAnswer(scene(s));
    expect(answer({ ask: 'relation', values: ['7', '5'] })).toBe('more');
    expect(answer({ ask: 'relation', values: ['462', '500'] })).toBe('less');
    expect(answer({ ask: 'relation', values: ['1/2', '2/4'] })).toBe('same');
    expect(answer({ ask: 'relation', values: ['99', '101'], claim: 'more' })).toBe(false);
    expect(answer({ ask: 'relation', values: ['6.3', '6.30'], claim: 'same' })).toBe(true);
  });
});

describe('relationWord', () => {
  it('reads relation words and yes or no, against the value they measure from', () => {
    expect(relationWord('the same', '4')).toBe('same');
    expect(relationWord('Same amount', '4')).toBe('same');
    expect(relationWord('bigger', '4')).toBe('more');
    expect(relationWord('fewer', '4')).toBe('less');
    expect(relationWord('less than 1/2', '1/2')).toBe('less');
    expect(relationWord('greater than 500', '500')).toBe('more');
    expect(relationWord('True', '4')).toBe(true);
    expect(relationWord('no', '4')).toBe(false);
    expect(relationWord('greater than 400', '500')).toBeNull();
    expect(relationWord('Mia ate more', '4')).toBeNull();
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

  it('plays a number-line item that picks one of the numbers it says', () => {
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
    expect(compareProblems(line, scene({ ask: 'greatest', values: ['5', '13'] }))).toEqual([]);
    expect(compareProblems(line, scene({ ask: 'least', values: ['5', '13'] }))).toEqual([
      'the scene picks 5 but the item answers 13',
    ]);
  });

  it('leaves pictures to their own screens', () => {
    const picture = {
      ...keypad('Which is greater, 7 or 12?', 12),
      visual: { kind: 'objects', emoji: '🍎', count: 12 },
    } as Item;
    expect(compareProblems(picture, scene({ ask: 'greatest', values: ['7', '12'] }))).toEqual([
      'the item has a objects picture',
    ]);
  });
});

const words = (narration: string, answer: string, ...others: string[]): Item => ({
  ...base,
  prompt: 'p',
  narration,
  type: 'tap',
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});
const than = words(
  'Is 462 greater than 500 or less than 500?',
  'less than 500',
  'greater than 500',
);
const relation = (values: string[], claim?: 'more' | 'less' | 'same') =>
  scene({ ask: 'relation', values, ...(claim && { claim }) });

describe('compareProblems for a relation', () => {
  it('accepts word choices whose answer the relation gives', () => {
    const same = words(
      'Pip has 4. Mia has 4. More, less, or the same?',
      'the same',
      'more',
      'less',
    );
    expect(compareProblems(same, relation(['4', '4']))).toEqual([]);
    expect(compareProblems(than, relation(['462', '500']))).toEqual([]);
  });

  it('accepts yes or no against a claim, and needs one', () => {
    const item = words('True or false? 99 is greater than 101.', 'False', 'True');
    expect(compareProblems(item, relation(['99', '101'], 'more'))).toEqual([]);
    expect(compareProblems(item, relation(['99', '101']))).toEqual([
      'yes-or-no choices need a claim',
    ]);
    expect(compareProblems(item, relation(['99', '101'], 'less'))).toEqual([
      'the scene answers true but the item answers false',
    ]);
  });

  it('refuses a wrong relation, other choices, unsaid values, and number answers', () => {
    const more = words('Is 7 more than 5, less, or the same?', 'more', 'less', 'the same');
    expect(compareProblems(more, relation(['5', '7']))).toEqual([
      'the scene answers less but the item answers more',
    ]);
    expect(compareProblems(than, relation(['500', '462']))).toEqual([
      'a choice is not more, less, same, yes, or no',
    ]);
    const people = words('Who gets less, Mia or Leo? 3 or 6 friends.', 'Leo', 'Mia');
    expect(compareProblems(people, relation(['3', '6']))).toEqual([
      'a choice is not more, less, same, yes, or no',
    ]);
    const unsaid = words('Is 7 more, less, or the same?', 'more', 'less', 'the same');
    expect(compareProblems(unsaid, relation(['7', '5']))).toEqual(['the item never says 5']);
    expect(compareProblems(keypad('Is 7 more than 5?', 7), relation(['7', '5']))).toEqual([
      'a relation needs word choices',
    ]);
  });

  it('lets towers stand in for a picture of one of the two amounts', () => {
    const apples = words('Pip has 7 apples. Mia has 5. More, less, or the same?', 'more', 'less');
    const item = { ...apples, visual: { kind: 'objects', emoji: '🍎', count: 7 } } as Item;
    expect(compareProblems(item, relation(['7', '5']))).toEqual([]);
    const other = { ...item, visual: { kind: 'objects', emoji: '🍎', count: 9 } } as Item;
    expect(compareProblems(other, relation(['7', '5']))).toEqual([
      'the item has a objects picture',
    ]);
  });
});
