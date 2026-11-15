import type { ContentBundle, Item, WallScene } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptWalls, applyWalls, wallCandidates, type TaggedWall } from './wall';

const base = { skillId: 's', difficulty: 1, why: 'w' } as const;
const keypad = (id: string, prompt: string, narration: string, answer: number): Item => ({
  ...base,
  id,
  prompt,
  narration,
  type: 'keypad',
  answer,
});
const tap = (id: string, narration: string, choices: string[]): Item => ({
  ...base,
  id,
  prompt: 'p',
  narration,
  type: 'tap',
  choices: choices.map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});

const tagged = (itemId: string, over: Partial<TaggedWall> = {}): TaggedWall => ({
  itemId,
  fits: true,
  ask: 'fill',
  than: '1/2',
  amount: null,
  parts: 4,
  note: '',
  ...over,
});

const half = keypad(
  'half',
  '1/2 = ?/4',
  'The fraction 1/2 is equivalent to a fraction with 4 as the denominator. Type the missing numerator.',
  2,
);
const greater = tap('greater', 'Is 11/8 greater than 3/2? Yes or no.', ['No', 'Yes']);

describe('wallCandidates', () => {
  it('keeps fraction compares and skips other games, pictures, and other topics', () => {
    const taken = { ...half, id: 'taken', game: { kind: 'grid' } } as unknown as Item;
    const picture = {
      ...half,
      id: 'picture',
      visual: { kind: 'objects', emoji: '🍪', count: 2 },
    } as Item;
    const sum = keypad('sum', '1/4 + 2/4', 'What is 1/4 + 2/4?', 3);
    const whole = keypad('whole', 'Is 12 greater than 9?', 'Is 12 greater than 9?', 1);
    expect(wallCandidates([half, greater, taken, picture, sum, whole]).map((i) => i.id)).toEqual([
      'half',
      'greater',
    ]);
  });
});

describe('acceptWalls', () => {
  it('keeps matching scenes and drops fields their ask ignores', () => {
    const { scenes, rejected } = acceptWalls([half, greater], {
      scenes: [
        tagged('half', { amount: '2/4' }),
        tagged('greater', { ask: 'more', than: '3/2', amount: '11/8', parts: 8 }),
      ],
    });
    expect(rejected).toEqual({});
    expect(scenes.half).toEqual({ kind: 'wall', ask: 'fill', than: '1/2', parts: 4 });
    expect(scenes.greater).toEqual({ kind: 'wall', ask: 'more', than: '3/2', amount: '11/8' });
  });

  it('rejects misfits, bad fractions, and wrong answers with a reason', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ ...half, id }));
    const { scenes, rejected } = acceptWalls(items, {
      scenes: [
        tagged('a', { fits: false, note: 'adds fractions' }),
        tagged('b', { than: 'half' }),
        tagged('c', { parts: null }),
        tagged('d', { ask: 'pass' }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected.a).toBe('does not fit: adds fractions');
    expect(rejected.b).toMatch(/not a fraction/);
    expect(rejected.c).toMatch(/needs parts/);
    expect(rejected.d).toBe('the wall builds 3 but the item answers 2');
  });
});

describe('applyWalls', () => {
  it('sets matching scenes and drops stale ones', () => {
    const bundle = { items: [half, { ...half, id: 'stale', answer: 3 }] } as ContentBundle;
    const scene: WallScene = { kind: 'wall', ask: 'fill', than: '1/2', parts: 4 };
    const { bundle: out, dropped } = applyWalls(bundle, { half: scene, stale: scene });
    expect(out.items[0].game).toEqual(scene);
    expect(out.items[1].game).toBeUndefined();
    expect(dropped).toEqual(['stale: the wall builds 2 but the item answers 3']);
  });
});
