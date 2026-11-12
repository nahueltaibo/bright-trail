import type { CompareScene, ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptCompares, applyCompares, compareCandidates, type TaggedCompare } from './compare';

const base = { skillId: 's', difficulty: 1, prompt: 'p', why: 'w' } as const;
const keypad = (id: string, narration: string, answer: number): Item => ({
  ...base,
  id,
  narration,
  type: 'keypad',
  answer,
});
const tap = (id: string, narration: string, choices: (number | string)[]): Item => ({
  ...base,
  id,
  narration,
  type: 'tap',
  choices: choices.map((v, i) =>
    typeof v === 'number'
      ? { id: 'abcd'[i], kind: 'number' as const, value: v }
      : { id: 'abcd'[i], kind: 'text' as const, text: v },
  ),
  answerChoiceId: 'a',
});

const tagged = (itemId: string, over: Partial<TaggedCompare> = {}): TaggedCompare => ({
  itemId,
  fits: true,
  ask: 'least',
  values: ['41', '36'],
  target: null,
  note: '',
  ...over,
});

const less = keypad('less', 'Type the number that is less, 41 or 36.', 36);

describe('compareCandidates', () => {
  it('keeps number picks and skips text choices, pictures, and other topics', () => {
    const fractions = tap('fractions', 'Which is greater, 5/8 or 3/8?', ['5/8', '3/8']);
    const words = tap('words', '462 and 500. Is 462 greater or less?', ['less than 500', 'more']);
    const fact = keypad('fact', 'What is 7 times 8?', 56);
    const picture = {
      ...keypad('picture', 'Which has more?', 4),
      visual: { kind: 'objects', emoji: '🐟', count: 4 },
    } as Item;
    expect(compareCandidates([less, fractions, words, fact, picture]).map((i) => i.id)).toEqual([
      'less',
      'fractions',
    ]);
  });
});

describe('acceptCompares', () => {
  it('keeps a matching scene and drops a null target', () => {
    const { scenes, rejected } = acceptCompares([less], { scenes: [tagged('less')] });
    expect(rejected).toEqual({});
    expect(scenes.less).toEqual({ kind: 'compare', ask: 'least', values: ['41', '36'] });
  });

  it('rejects misfits, bad values, and wrong picks with a reason', () => {
    const items = ['a', 'b', 'c'].map((id) => ({ ...less, id }));
    const { scenes, rejected } = acceptCompares(items, {
      scenes: [
        tagged('a', { fits: false, note: 'not a compare' }),
        tagged('b', { values: ['41', 'forty'] }),
        tagged('c', { ask: 'greatest' }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected.a).toBe('does not fit: not a compare');
    expect(rejected.b).toMatch(/not a number/);
    expect(rejected.c).toBe('the scene picks 41 but the item answers 36');
  });
});

describe('applyCompares', () => {
  it('sets matching scenes and drops stale ones', () => {
    const bundle = { items: [less, { ...less, id: 'stale', answer: 41 }] } as ContentBundle;
    const scene: CompareScene = { kind: 'compare', ask: 'least', values: ['41', '36'] };
    const { bundle: out, dropped } = applyCompares(bundle, { less: scene, stale: scene });
    expect(out.items[0].game).toEqual(scene);
    expect(out.items[1].game).toBeUndefined();
    expect(dropped).toEqual(['stale: the scene picks 36 but the item answers 41']);
  });
});
