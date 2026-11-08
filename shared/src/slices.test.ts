import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import { SliceSceneSchema, sliceProblems, sliceValues, type SliceScene } from './slices';

const scene = (s: Omit<SliceScene, 'kind'>): SliceScene =>
  SliceSceneSchema.parse({ kind: 'slices', ...s });

const keypad = (answer: number): Item => ({
  id: 'k',
  skillId: 's',
  difficulty: 1,
  narration: 'n',
  prompt: 'p',
  why: 'w',
  type: 'keypad',
  answer,
});

const tap = (choices: string[], answer: number): Item => ({
  id: 't',
  skillId: 's',
  difficulty: 1,
  narration: 'n',
  prompt: 'p',
  why: 'w',
  type: 'tap',
  choices: choices.map((text, i) => ({ id: `c${i}`, kind: 'text', text })),
  answerChoiceId: `c${answer}`,
});

describe('sliceValues', () => {
  it('counts picked slices as a count or a fraction', () => {
    expect(sliceValues(scene({ ask: 'picked', shape: 'circle', parts: 4, picked: 3 }))).toEqual([
      3, 0.75,
    ]);
  });

  it('counts what is left after the story eats some', () => {
    const s = scene({ ask: 'left', shape: 'circle', food: 'pizza', parts: 6, eaten: 1, take: 2 });
    expect(sliceValues(s)).toEqual([3, 0.5]);
  });

  it('turns halves into fourths', () => {
    const s = scene({ ask: 'same', shape: 'circle', parts: 2, picked: 1, cutInto: 4 });
    expect(sliceValues(s)).toEqual([2, 0.5]);
  });

  it('shares a pan among friends', () => {
    const s = scene({ ask: 'each', shape: 'rectangle', parts: 8, friends: 4 });
    expect(sliceValues(s)).toEqual([2, 0.25]);
  });

  it('picks the bigger or the smaller slice', () => {
    expect(sliceValues(scene({ ask: 'bigger', shape: 'circle', parts: 2, other: 4 }))).toEqual([
      0.5,
    ]);
    expect(
      sliceValues(scene({ ask: 'bigger', shape: 'circle', parts: 2, other: 8, want: 'smaller' })),
    ).toEqual([0.125]);
  });
});

describe('SliceSceneSchema', () => {
  it('rejects a story that uses more slices than there are', () => {
    const r = SliceSceneSchema.safeParse({
      kind: 'slices',
      ask: 'add',
      shape: 'rectangle',
      parts: 8,
      picked: 6,
      more: 3,
    });
    expect(r.error!.issues[0].message).toBe('the story uses 9 slices but there are 8');
  });

  it('rejects a recut that does not come out whole', () => {
    const r = SliceSceneSchema.safeParse({
      kind: 'slices',
      ask: 'same',
      shape: 'circle',
      parts: 4,
      picked: 1,
      cutInto: 2,
    });
    expect(r.error!.issues[0].message).toBe('1/4 is not a whole number of 1/2 slices');
  });
});

describe('sliceProblems', () => {
  const picked = scene({ ask: 'picked', shape: 'circle', food: 'pizza', parts: 4, picked: 3 });

  it('accepts a typed count and a fraction choice', () => {
    expect(sliceProblems(keypad(3), picked)).toEqual([]);
    expect(sliceProblems(tap(['1/4', '3/4', '4/3'], 1), picked)).toEqual([]);
  });

  it('rejects an answer the scene does not show', () => {
    expect(sliceProblems(tap(['1/4', '3/4'], 0), picked)).toEqual([
      'the scene shows 3 or 0.75 but the item answers 0.25',
    ]);
  });

  it('lets "Same" stand beside the fractions it compares', () => {
    const bigger = scene({ ask: 'bigger', shape: 'circle', parts: 2, other: 4 });
    expect(sliceProblems(tap(['1/2', '1/4', 'Same'], 0), bigger)).toEqual([]);
    expect(sliceProblems(tap(['Mia', 'Jay'], 0), bigger)).toContain(
      'the item answer is not a number',
    );
  });
});
