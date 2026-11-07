import { ItemSchema, type Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { solveItem } from './solver';
import type { GenCheck } from './schema';

const base = { id: 'x-tap-1', skillId: 'x', difficulty: 2, why: 'Because.' };
const item = (fields: Record<string, unknown>): Item => ItemSchema.parse({ ...base, ...fields });
const check = (
  rule: GenCheck['rule'],
  expr = '',
  choices: GenCheck['choices'] = [],
  note = '',
): GenCheck => ({
  rule,
  expr,
  choices,
  note,
});

const tapNumbers = (narration: string, values: number[], answer: string) =>
  item({
    type: 'tap',
    narration,
    prompt: narration,
    choices: values.map((value, i) => ({ id: 'abcd'[i], kind: 'number', value })),
    answerChoiceId: answer,
  });

describe('solveItem: keypad and number line', () => {
  const keypad = (answer: number, narration = 'What is 7 + 5?') =>
    item({ type: 'keypad', narration, prompt: '7 + 5 = ?', answer });

  it('solves a right keypad answer', () => {
    expect(solveItem(keypad(12), check('equals', '7 + 5'))).toEqual({
      level: 'solved',
      problems: [],
    });
  });

  it('catches a wrong keypad answer', () => {
    expect(solveItem(keypad(13), check('equals', '7 + 5')).problems).toEqual([
      'answer is 13 but 7 + 5 = 12',
    ]);
  });

  it('marks a check with numbers the child never hears as linked', () => {
    expect(solveItem(keypad(12), check('equals', '6 + 6')).level).toBe('linked');
  });

  it('needs rule equals or none', () => {
    expect(solveItem(keypad(12), check('greatest')).problems[0]).toMatch(/need rule "equals"/);
  });

  it('reports a check that does not evaluate', () => {
    expect(solveItem(keypad(12), check('equals', '7 +')).problems[0]).toMatch(/does not evaluate/);
    expect(solveItem(keypad(12), check('equals', '7 > 5')).problems[0]).toMatch(/not a number/);
  });

  it('accepts rule none with a note as unchecked, and rejects it without one', () => {
    expect(solveItem(keypad(12), check('none', '', [], 'word problem'))).toEqual({
      level: 'unchecked',
      problems: [],
    });
    expect(solveItem(keypad(12), check('none')).problems[0]).toMatch(/needs a note/);
  });

  it('solves a number-line target, negatives and decimals included', () => {
    const negative = item({
      type: 'number-line',
      narration: 'Move the frog to 3 below zero, -3.',
      prompt: '-3',
      min: -10,
      max: 10,
      step: 1,
      target: -3,
    });
    expect(solveItem(negative, check('equals', '-3')).level).toBe('solved');
    const decimal = item({
      type: 'number-line',
      narration: 'Hop to 0.1 + 0.2.',
      prompt: '0.1 + 0.2',
      min: 0,
      max: 1,
      step: 0.1,
      target: 0.3,
    });
    expect(solveItem(decimal, check('equals', '0.1 + 0.2')).problems).toEqual([]);
    const wrong = { ...decimal, target: 0.4 } as Item;
    expect(solveItem(wrong, check('equals', '0.1 + 0.2')).problems[0]).toMatch(/target is 0.4/);
  });

  it('uses the picture count', () => {
    const counting = item({
      type: 'keypad',
      narration: 'How many fish?',
      prompt: 'How many?',
      visual: { kind: 'objects', emoji: '🐟', count: 7 },
      answer: 7,
    });
    expect(solveItem(counting, check('equals', 'count'))).toEqual({
      level: 'solved',
      problems: [],
    });
    expect(
      solveItem({ ...counting, answer: 8 } as Item, check('equals', 'count')).problems,
    ).toHaveLength(1);
  });
});

describe('solveItem: tap equals', () => {
  it('solves when exactly the answer choice matches', () => {
    const tap = tapNumbers('What is 2 + 3? Is it 4, 5, or 6?', [4, 5, 6], 'b');
    expect(solveItem(tap, check('equals', '2 + 3'))).toEqual({ level: 'solved', problems: [] });
  });

  it('catches a wrong marked answer', () => {
    const tap = tapNumbers('What is 2 + 3? Is it 4, 5, or 6?', [4, 5, 6], 'a');
    expect(solveItem(tap, check('equals', '2 + 3')).problems[0]).toMatch(
      /choice b equals 5, but the answer is a/,
    );
  });

  it('catches two right choices and none', () => {
    const two = tapNumbers('What is 2 + 3? Is it 5, 5, or 6?', [5, 5, 6], 'a');
    expect(solveItem(two, check('equals', '2 + 3')).problems[0]).toMatch(
      /choices a, b all equal 5/,
    );
    const none = tapNumbers('What is 2 + 3? Is it 4, 7, or 6?', [4, 7, 6], 'a');
    expect(solveItem(none, check('equals', '2 + 3')).problems[0]).toMatch(/no choice equals 5/);
  });

  it('reads fraction, percent, and money text choices', () => {
    const tap = item({
      type: 'tap',
      narration: 'Which is the same as 1/4: 25%, 40%, or 4%?',
      prompt: '1/4 = ?',
      choices: [
        { id: 'a', kind: 'text', text: '25%' },
        { id: 'b', kind: 'text', text: '40%' },
        { id: 'c', kind: 'text', text: '4%' },
      ],
      answerChoiceId: 'a',
    });
    expect(solveItem(tap, check('equals', '1/4')).level).toBe('solved');
  });

  it('rejects a declared value that contradicts what the choice shows', () => {
    const tap = tapNumbers('What is 2 + 3? Is it 4, 5, or 6?', [4, 5, 6], 'b');
    const result = solveItem(tap, check('equals', '2 + 3', [{ id: 'b', expr: '6' }]));
    expect(result.problems[0]).toMatch(/choice b shows 5 but its check says 6/);
  });

  it('needs a value for word choices, and links them when given', () => {
    const tap = item({
      type: 'tap',
      narration: 'Count the 7 frogs. Is it about 5 or about 10?',
      prompt: 'About how many?',
      choices: [
        { id: 'a', kind: 'text', text: 'about 5' },
        { id: 'b', kind: 'text', text: 'about 10' },
      ],
      answerChoiceId: 'a',
    });
    expect(solveItem(tap, check('equals', '5')).problems[0]).toMatch(
      /choice a has no number value/,
    );
    const linked = solveItem(
      tap,
      check('equals', '5', [
        { id: 'a', expr: '5' },
        { id: 'b', expr: '10' },
      ]),
    );
    expect(linked).toEqual({ level: 'linked', problems: [] });
  });

  it('names unknown choice ids in the check', () => {
    const tap = tapNumbers('What is 2 + 3? Is it 4, 5, or 6?', [4, 5, 6], 'b');
    expect(solveItem(tap, check('equals', '2 + 3', [{ id: 'z', expr: '1' }])).problems[0]).toMatch(
      /unknown choice z/,
    );
  });

  it('values picture choices by their count', () => {
    const tap = item({
      type: 'tap',
      narration: 'Which shows 3 + 1: three apples, or four apples?',
      prompt: '3 + 1',
      choices: [
        {
          id: 'a',
          kind: 'visual',
          visual: { kind: 'objects', emoji: '🍎', count: 3 },
          narration: 'three apples',
        },
        {
          id: 'b',
          kind: 'visual',
          visual: { kind: 'ten-frame', filled: 4 },
          narration: 'four apples',
        },
      ],
      answerChoiceId: 'b',
    });
    expect(solveItem(tap, check('equals', '3 + 1'))).toEqual({ level: 'solved', problems: [] });
  });
});

describe('solveItem: range-graded nearest', () => {
  const estimate = (count: number, answer: string) =>
    item({
      type: 'tap',
      narration: 'Is it closer to 5 or closer to 10?',
      prompt: 'About how many?',
      visual: { kind: 'objects', emoji: '🐞', count },
      choices: [
        { id: 'a', kind: 'text', text: 'closer to 5' },
        { id: 'b', kind: 'text', text: 'closer to 10' },
      ],
      answerChoiceId: answer,
    });
  const benchmarks = [
    { id: 'a', expr: '5' },
    { id: 'b', expr: '10' },
  ];

  it('grades by the closest benchmark', () => {
    expect(solveItem(estimate(9, 'b'), check('nearest', 'count', benchmarks))).toEqual({
      level: 'linked',
      problems: [],
    });
    expect(solveItem(estimate(4, 'a'), check('nearest', 'count', benchmarks)).problems).toEqual([]);
  });

  it('catches the wrong benchmark', () => {
    expect(solveItem(estimate(9, 'a'), check('nearest', 'count', benchmarks)).problems[0]).toMatch(
      /9 is closest to choice b/,
    );
  });

  it('rejects amounts too close to halfway', () => {
    const near = item({
      type: 'tap',
      narration: 'Sam has 3 bags of 10 marbles and 4 more. Is it closer to 20 or 50?',
      prompt: 'Closer to 20 or 50?',
      choices: [
        { id: 'a', kind: 'number', value: 20 },
        { id: 'b', kind: 'number', value: 50 },
      ],
      answerChoiceId: 'a',
    });
    expect(solveItem(near, check('nearest', '3 * 10 + 4')).problems[0]).toMatch(
      /too close to halfway/,
    );
  });

  it('accepts a clear amount from a description', () => {
    const big = item({
      type: 'tap',
      narration: 'Sam has 4 bags of 10 marbles and 2 more. Is it closer to 20 or 50?',
      prompt: 'Closer to 20 or 50?',
      choices: [
        { id: 'a', kind: 'number', value: 20 },
        { id: 'b', kind: 'number', value: 50 },
      ],
      answerChoiceId: 'b',
    });
    expect(solveItem(big, check('nearest', '4 * 10 + 2'))).toEqual({
      level: 'solved',
      problems: [],
    });
  });
});

describe('solveItem: greatest, least, true', () => {
  it('finds the greatest fraction', () => {
    const tap = item({
      type: 'tap',
      narration: 'Which is greatest: 3/4, 2/3, or 1/2?',
      prompt: 'Greatest?',
      choices: [
        { id: 'a', kind: 'text', text: '3/4' },
        { id: 'b', kind: 'text', text: '2/3' },
        { id: 'c', kind: 'text', text: '1/2' },
      ],
      answerChoiceId: 'a',
    });
    expect(solveItem(tap, check('greatest'))).toEqual({ level: 'solved', problems: [] });
    expect(solveItem(tap, check('least')).problems[0]).toMatch(/choice c is the least/);
  });

  it('catches a tie', () => {
    const tap = tapNumbers('Which is greater, 0.5 or 0.50?', [0.5, 0.5], 'a');
    expect(solveItem(tap, check('greatest')).problems[0]).toMatch(/tie/);
  });

  it('checks true statements and always asks the reviewer to confirm the labels', () => {
    const tap = item({
      type: 'tap',
      narration: 'Is 14 even or odd?',
      prompt: '14',
      choices: [
        { id: 'a', kind: 'text', text: 'even' },
        { id: 'b', kind: 'text', text: 'odd' },
      ],
      answerChoiceId: 'a',
    });
    const right = check('true', '', [
      { id: 'a', expr: 'isEven(14)' },
      { id: 'b', expr: 'isOdd(14)' },
    ]);
    expect(solveItem(tap, right)).toEqual({ level: 'linked', problems: [] });
    expect(solveItem({ ...tap, answerChoiceId: 'b' } as Item, right).problems[0]).toMatch(
      /choice a is the true one/,
    );
    const both = check('true', '', [
      { id: 'a', expr: 'isEven(14)' },
      { id: 'b', expr: '14 > 2' },
    ]);
    expect(solveItem(tap, both).problems[0]).toMatch(/2 choices are true/);
    const missing = check('true', '', [{ id: 'a', expr: 'isEven(14)' }]);
    expect(solveItem(tap, missing).problems[0]).toMatch(/choice b needs a statement/);
    const numeric = check('true', '', [
      { id: 'a', expr: '14' },
      { id: 'b', expr: 'isOdd(14)' },
    ]);
    expect(solveItem(tap, numeric).problems[0]).toMatch(/is a number/);
  });
});
