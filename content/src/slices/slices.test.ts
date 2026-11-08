import type { ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptSlices, applySlices, sliceCandidates, type TaggedSlice } from './slices';

const keypad = (id: string, narration: string, answer: number, picked?: number): Item => ({
  id,
  skillId: 's',
  difficulty: 1,
  narration,
  prompt: 'p',
  why: 'w',
  type: 'keypad',
  answer,
  ...(picked !== undefined && {
    visual: { kind: 'fraction', shape: 'circle', parts: 4, picked },
  }),
});

const tagged = (itemId: string, over: Partial<TaggedSlice> = {}): TaggedSlice => ({
  itemId,
  fits: true,
  ask: 'picked',
  shape: 'circle',
  food: 'pizza',
  parts: 4,
  wholes: null,
  picked: 3,
  eaten: null,
  take: null,
  more: null,
  cutInto: null,
  other: null,
  want: null,
  friends: null,
  who: null,
  note: '',
  ...over,
});

const pizza = keypad('pizza', 'A pizza has 4 slices. Mia picks 3. How many slices?', 3, 3);

describe('sliceCandidates', () => {
  it('keeps fraction stories and skips the rest', () => {
    const count = keypad('count', 'Count the ducks.', 4);
    expect(sliceCandidates([pizza, count]).map((i) => i.id)).toEqual(['pizza']);
  });
});

describe('acceptSlices', () => {
  it('keeps a matching scene and drops nulls', () => {
    const { slices, rejected } = acceptSlices([pizza], { slices: [tagged('pizza')] });
    expect(rejected).toEqual({});
    expect(slices.pizza).toEqual({
      kind: 'slices',
      ask: 'picked',
      shape: 'circle',
      food: 'pizza',
      parts: 4,
      picked: 3,
    });
  });

  it('rejects a scene that differs from the picture', () => {
    const { rejected } = acceptSlices([keypad('k', 'n', 2, 2)], {
      slices: [tagged('k', { parts: 2, picked: 2 })],
    });
    expect(rejected.k).toBe('the picture has 4 parts, the scene 2');
  });

  it('rejects a scene whose answer differs from the item', () => {
    const { rejected } = acceptSlices([pizza], { slices: [tagged('pizza', { picked: 2 })] });
    expect(rejected.pizza).toContain('the scene shows 2 or 0.5 but the item answers 3');
  });
});

describe('applySlices', () => {
  it('drops a scene once its item changed', () => {
    const { slices } = acceptSlices([pizza], { slices: [tagged('pizza')] });
    const changed = { items: [{ ...pizza, answer: 4 }] } as unknown as ContentBundle;
    const applied = applySlices(changed, slices);
    expect(applied.bundle.items[0].slices).toBeUndefined();
    expect(applied.dropped).toEqual(['pizza: the scene shows 3 or 0.75 but the item answers 4']);
  });
});
