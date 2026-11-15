import type { ArrayScene, ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptArrays, applyArrays, arrayCandidates, type TaggedArray } from './arrays';

const base = { skillId: 's', difficulty: 1, why: 'w' } as const;
const keypad = (id: string, prompt: string, narration: string, answer: number): Item => ({
  ...base,
  id,
  prompt,
  narration,
  type: 'keypad',
  answer,
});
const tap = (
  id: string,
  prompt: string,
  narration: string,
  choices: (number | string)[],
): Item => ({
  ...base,
  id,
  prompt,
  narration,
  type: 'tap',
  choices: choices.map((v, i) =>
    typeof v === 'number'
      ? { id: 'abcd'[i], kind: 'number' as const, value: v }
      : { id: 'abcd'[i], kind: 'text' as const, text: v },
  ),
  answerChoiceId: 'a',
});

const tagged = (itemId: string, over: Partial<TaggedArray> = {}): TaggedArray => ({
  itemId,
  fits: true,
  ask: 'total',
  rows: 3,
  columns: 4,
  thing: null,
  find: null,
  splitBy: null,
  splitAt: null,
  note: '',
  ...over,
});

const rows = keypad('rows', '3 rows of 4', 'An array has 3 rows of 4 dots. How many dots?', 12);
const split = tap('split', '4 × 6 = 4 × 5 + 4 × ?', '4 × 6 is 4 × 5 plus 4 times what?', [1, 2]);

describe('arrayCandidates', () => {
  it('keeps times and rows items, and skips text choices, other pictures, and other topics', () => {
    const fact = tap('fact', '4 rows of 8', 'Which fact? 4 + 8 or 4 × 8?', ['4 × 8', '4 + 8']);
    const family = tap('family', 'Fact family for 6 × 3 = 18', 'Which fact?', ['18 ÷ 3 = 6']);
    const sum = keypad('sum', '3 + 4 = ?', 'What is 3 + 4?', 7);
    const frame = {
      ...keypad('frame', '2 × 3', 'How many?', 6),
      visual: { kind: 'ten-frame', filled: 6 },
    } as Item;
    expect(arrayCandidates([rows, split, fact, family, sum, frame]).map((i) => i.id)).toEqual([
      'rows',
      'split',
    ]);
  });

  it('keeps an objects picture and a whole-number × or ÷ fact on a number line', () => {
    const objects = {
      ...keypad('objects', '4 groups of 2 = ?', 'There are 4 groups of 2 ducks.', 8),
      visual: { kind: 'objects', emoji: '🦆', count: 4 },
    } as Item;
    const line = (id: string, prompt: string, target: number): Item => ({
      ...base,
      id,
      prompt,
      narration: `Move the frog to ${prompt}`,
      type: 'number-line',
      min: 0,
      max: 40,
      step: 1,
      target,
    });
    const items = [
      objects,
      line('times', '7 × 5 = ?', 35),
      line('divide', '45 ÷ 5 = ?', 9),
      line('hops', '3 hops of 2', 6),
      line('fraction', '5 ÷ 1/2', 10),
    ];
    expect(arrayCandidates(items).map((i) => i.id)).toEqual(['objects', 'times', 'divide']);
  });
});

describe('acceptArrays', () => {
  it('keeps a matching scene and drops the fields its ask does not use', () => {
    const { scenes, rejected } = acceptArrays([rows], {
      scenes: [tagged('rows', { thing: 'star', find: 'total', splitAt: 2 })],
    });
    expect(rejected).toEqual({});
    expect(scenes.rows).toEqual({
      kind: 'arrays',
      ask: 'total',
      rows: 3,
      columns: 4,
      thing: 'star',
    });
  });

  it('builds a split from its flat fields', () => {
    const { scenes } = acceptArrays([split], {
      scenes: [
        tagged('split', {
          ask: 'split',
          rows: 4,
          columns: 6,
          find: 'second',
          splitBy: 'columns',
          splitAt: 5,
        }),
      ],
    });
    expect(scenes.split).toEqual({
      kind: 'arrays',
      ask: 'split',
      rows: 4,
      columns: 6,
      find: 'second',
      split: { by: 'columns', at: 5 },
    });
  });

  it('rejects misfits, bad scenes, and wrong answers with a reason', () => {
    const { scenes, rejected } = acceptArrays([rows, split], {
      scenes: [
        tagged('rows', { ask: 'rows', rows: 2, columns: 6 }),
        tagged('split', { ask: 'split', rows: 4, columns: 6, find: 'second' }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected.rows).toBe(
      'the scene finds 2 but the item answers 12; the item never says 12; the item never says 6',
    );
    expect(rejected.split).toBe('split needs a cut');
    expect(acceptArrays([rows], { scenes: [tagged('rows', { fits: false, note: 'no' })] })).toEqual(
      { scenes: {}, rejected: { rows: 'does not fit: no' } },
    );
  });
});

describe('applyArrays', () => {
  it('drops a stored scene its item no longer matches', () => {
    const bundle = { items: [rows] } as unknown as ContentBundle;
    const scene: ArrayScene = { kind: 'arrays', ask: 'total', rows: 3, columns: 5 };
    const applied = applyArrays(bundle, { rows: scene });
    expect(applied.bundle.items[0].game).toBeUndefined();
    expect(applied.dropped).toEqual([
      'rows: the scene finds 15 but the item answers 12; the item never says 5',
    ]);
  });
});
