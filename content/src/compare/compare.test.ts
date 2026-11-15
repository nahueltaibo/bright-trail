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
  claim: null,
  note: '',
  ...over,
});

const less = keypad('less', 'Type the number that is less, 41 or 36.', 36);

const line = (id: string, narration: string, target: number): Item => ({
  ...base,
  id,
  narration,
  type: 'number-line',
  min: 0,
  max: 50,
  step: 1,
  target,
});

describe('compareCandidates', () => {
  it('keeps number picks and skips mixed choices, pictures, and other topics', () => {
    const fractions = tap('fractions', 'Which is greater, 5/8 or 3/8?', ['5/8', '3/8']);
    const mixed = tap('mixed', '462 and 500. Is 462 greater or less?', ['less than 500', '462']);
    const fact = keypad('fact', 'What is 7 times 8?', 56);
    const picture = {
      ...keypad('picture', 'Which has more?', 4),
      visual: { kind: 'objects', emoji: '🐟', count: 4 },
    } as Item;
    expect(compareCandidates([less, fractions, mixed, fact, picture]).map((i) => i.id)).toEqual([
      'less',
      'fractions',
    ]);
  });

  it('keeps number lines whose target is one of the numbers they say', () => {
    const least = line('least', 'Move the frog to the least number, 44, 31, or 38.', 31);
    const more = line('more', 'Hop the frog to 1 more than 4.', 5);
    const between = line('between', 'Move the frog to the number between 38 and 40.', 39);
    expect(compareCandidates([least, more, between]).map((i) => i.id)).toEqual(['least']);
  });

  it('keeps word choices like "the same" and "true", with at most a picture of things', () => {
    const same = tap('same', 'Pip has 4. Mia has 4. More, less, or the same?', [
      'the same',
      'more',
      'less',
    ]);
    const truth = tap('truth', 'True or false? 99 is greater than 101.', ['False', 'True']);
    const than = tap('than', 'Is 462 greater than 500 or less than 500?', [
      'less than 500',
      'greater than 500',
    ]);
    const apples = {
      ...same,
      id: 'apples',
      visual: { kind: 'objects', emoji: '🍎', count: 4 },
    } as Item;
    const frame = { ...same, id: 'frame', visual: { kind: 'ten-frame', filled: 4 } } as Item;
    const people = tap('people', 'Who gets less, Mia or Leo?', ['Leo', 'Mia']);
    const topic = tap('topic', 'Is a square a rectangle?', ['yes', 'no']);
    expect(
      compareCandidates([same, truth, than, apples, frame, people, topic]).map((i) => i.id),
    ).toEqual(['same', 'truth', 'than', 'apples']);
  });

  it('skips items another game plays', () => {
    const played = { ...less, id: 'played', game: { kind: 'blocks' } } as unknown as Item;
    expect(compareCandidates([played])).toEqual([]);
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

describe('acceptCompares for a relation', () => {
  it('keeps a claim for a relation and drops it for other asks', () => {
    const truth = tap('truth', 'True or false? 99 is greater than 101.', ['False', 'True']);
    const { scenes, rejected } = acceptCompares([truth, less], {
      scenes: [
        tagged('truth', { ask: 'relation', values: ['99', '101'], claim: 'more' }),
        tagged('less', { claim: 'less' }),
      ],
    });
    expect(rejected).toEqual({});
    expect(scenes.truth).toEqual({
      kind: 'compare',
      ask: 'relation',
      values: ['99', '101'],
      claim: 'more',
    });
    expect(scenes.less).toEqual({ kind: 'compare', ask: 'least', values: ['41', '36'] });
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
