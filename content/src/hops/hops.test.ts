import type { ContentBundle, Item, NumberLineItem } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptHops, applyHops, hopsCandidates, type TaggedHops } from './hops';

const line = (id: string, narration: string, target: number): NumberLineItem => ({
  id,
  skillId: 's',
  difficulty: 1,
  narration,
  prompt: 'p',
  why: 'w',
  type: 'number-line',
  min: 0,
  max: 30,
  step: 1,
  target,
});

const tagged = (itemId: string, over: Partial<TaggedHops> = {}): TaggedHops => ({
  itemId,
  fits: true,
  start: 20,
  legs: [{ by: -1, times: 6 }],
  note: '',
  ...over,
});

const back = line('back', 'The frog starts at 20. It hops back 6.', 14);

describe('hopsCandidates', () => {
  it('keeps number lines no other minigame plays', () => {
    const keypad = { ...back, id: 'k', type: 'keypad', answer: 3 } as unknown as Item;
    expect(hopsCandidates([back, keypad]).map((i) => i.id)).toEqual(['back']);
  });
});

describe('acceptHops', () => {
  it('keeps a path that lands on the answer', () => {
    const { paths, rejected } = acceptHops([back], { paths: [tagged('back')] });
    expect(rejected).toEqual({});
    expect(paths.back).toEqual({ start: 20, legs: [{ by: -1, times: 6 }] });
  });

  it('rejects a path that misses or is left to the app', () => {
    const { rejected } = acceptHops([back], {
      paths: [tagged('back', { legs: [{ by: -1, times: 5 }] })],
    });
    expect(rejected.back).toBe('the frog lands on 15 but the answer is 14');
    const plain = acceptHops([back], { paths: [tagged('back', { fits: false, note: 'plain' })] });
    expect(plain.rejected.back).toBe('does not fit: plain');
  });
});

describe('applyHops', () => {
  it('drops a path once its item changed', () => {
    const { paths } = acceptHops([back], { paths: [tagged('back')] });
    const changed = { items: [{ ...back, target: 15 }] } as unknown as ContentBundle;
    const applied = applyHops(changed, paths);
    expect((applied.bundle.items[0] as NumberLineItem).hops).toBeUndefined();
    expect(applied.dropped).toEqual(['back: the frog lands on 14 but the answer is 15']);
  });
});
