import type { ContentBundle, Item, StonesScene } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptStones, applyStones, stonesCandidates, type TaggedStones } from './stones';

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

const tagged = (itemId: string, over: Partial<TaggedStones> = {}): TaggedStones => ({
  itemId,
  fits: true,
  stones: ['2', '4', '6', '8'],
  missing: 3,
  note: '',
  ...over,
});

const twos = keypad('twos', '2, 4, 6, ?', 'Count by 2s. 2, 4, 6. What comes next?', 8);

describe('stonesCandidates', () => {
  it('keeps counting runs and skips pictures, number lines, and choice lists', () => {
    const down = keypad('down', '5, ?', 'Count down from 5. What number comes next?', 4);
    const thirds = tap('thirds', '1/3, 2/3, ...', 'Count by thirds.', ['3/3', '4/3', '2/4']);
    const sum = tap('sum', '5 + 2 = ?', 'What is 5 + 2? Is it 6, 7, or 8?', [7, 6, 8]);
    const words = tap('words', '4 to 5', 'Counting up. Bigger or smaller?', ['bigger', 'smaller']);
    const counted = {
      ...keypad('counted', '5, 10, ?', 'Count by 5s.', 15),
      visual: { kind: 'objects' },
    } as Item;
    const line: Item = {
      ...base,
      id: 'line',
      prompt: '13, 14, ?',
      narration: 'Count 13, 14. Hop Pip to the next number.',
      type: 'number-line',
      min: 0,
      max: 20,
      step: 1,
      target: 15,
    };
    expect(
      stonesCandidates([twos, down, thirds, sum, words, counted, line]).map((i) => i.id),
    ).toEqual(['twos', 'down', 'thirds']);
  });
});

describe('acceptStones', () => {
  it('keeps scenes whose missing stone is the answer and rejects the rest with a reason', () => {
    const next = keypad('next', '12, ?', 'Pip is on stone 12. Which number is next?', 13);
    const result = acceptStones([twos, next], {
      scenes: [
        tagged('twos'),
        tagged('next', { stones: ['12', '13', '14'], missing: 2 }),
        tagged('unknown'),
      ],
    });
    expect(Object.keys(result.scenes)).toEqual(['twos']);
    expect(result.rejected.next).toMatch(/missing stone is 14/);
  });

  it('reports scenes that do not fit or break the schema', () => {
    const result = acceptStones([twos], {
      scenes: [tagged('twos', { stones: ['2', '4', '7', '8'] })],
    });
    expect(result.rejected.twos).toMatch(/same step/);
    const skipped = acceptStones([twos], {
      scenes: [tagged('twos', { fits: false, note: 'no run' })],
    });
    expect(skipped.rejected.twos).toBe('does not fit: no run');
  });
});

describe('applyStones', () => {
  it('drops a stored scene once its item changes', () => {
    const scene: StonesScene = { kind: 'stones', stones: ['2', '4', '6', '8'], missing: 3 };
    const bundle = {
      items: [twos, { ...twos, id: 'other', answer: 9 }],
    } as unknown as ContentBundle;
    const { bundle: out, dropped } = applyStones(bundle, { twos: scene, other: scene });
    expect(out.items[0].game).toEqual(scene);
    expect(out.items[1].game).toBeUndefined();
    expect(dropped).toEqual(['other: the missing stone is 8 but the item answers 9']);
  });
});
