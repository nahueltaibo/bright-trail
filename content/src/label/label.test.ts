import type { ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import {
  acceptLabels,
  applyLabels,
  labelCandidates,
  namesPart,
  partsNamed,
  type TaggedLabel,
} from './label';

const tap = (
  id: string,
  prompt: string,
  narration: string,
  choices: string[],
  answer = 0,
): Item => ({
  id,
  skillId: 's',
  difficulty: 1,
  why: 'w',
  prompt,
  narration,
  type: 'tap',
  choices: choices.map((text, i) => ({ id: 'abcd'[i]!, kind: 'text' as const, text })),
  answerChoiceId: 'abcd'[answer]!,
});

// Real science items from the Grade 1 bundle.
const roots = tap(
  'g1-sci-plant-animal-features-tap-7',
  'What holds a plant in place?',
  'Which plant part holds the plant in the soil: leaves, roots, or petals?',
  ['leaves', 'petals', 'roots'],
  2,
);
const wings = tap(
  'g1-sci-plant-animal-features-tap-3',
  'What helps a bird fly?',
  'Which part helps a bird fly: wings, or roots?',
  ['roots', 'wings'],
  1,
);
const eyes = tap(
  'g1-sci-body-parts-tap-1',
  'What helps you see?',
  'Which body part helps you see: your eyes, your ears, or your nose?',
  ['your eyes', 'your ears', 'your nose'],
);

const tagged = (itemId: string, over: Partial<TaggedLabel> = {}): TaggedLabel => ({
  itemId,
  fits: true,
  picture: 'plant',
  part: 'roots',
  others: ['flower', 'stem'],
  note: '',
  ...over,
});

describe('namesPart', () => {
  it('matches without articles, case, or simple plurals', () => {
    expect(namesPart('the roots', 'roots')).toBe(true);
    expect(namesPart('root', 'roots')).toBe(true);
    expect(namesPart('Leaves', 'leaf')).toBe(true);
    expect(namesPart('your Hands', 'hand')).toBe(true);
    expect(namesPart('the Sun', 'sun')).toBe(true);
    expect(namesPart('petals', 'flower')).toBe(false);
    expect(namesPart('stems of roses', 'stem')).toBe(false);
  });

  it('finds every picture with the part', () => {
    expect(partsNamed('the head')).toEqual([
      { picture: 'insect', part: 'head' },
      { picture: 'body', part: 'head' },
    ]);
    expect(partsNamed('your eyes')).toEqual([]);
  });
});

describe('labelCandidates', () => {
  it('keeps text tap items whose answer names a part, and skips pictures and other games', () => {
    const picture = { ...roots, id: 'picture', visual: { kind: 'emoji', emoji: '🌱' } } as Item;
    const taken = { ...roots, id: 'taken', game: { kind: 'sort' } } as unknown as Item;
    const keypad = { ...roots, id: 'keypad', type: 'keypad', answer: 3 } as unknown as Item;
    expect(labelCandidates([roots, wings, eyes, picture, taken, keypad]).map((i) => i.id)).toEqual([
      roots.id,
      wings.id,
    ]);
  });
});

describe('acceptLabels', () => {
  it('builds the scene in picture order with the answer on the asked tag', () => {
    const { scenes, rejected } = acceptLabels([roots], {
      scenes: [tagged(roots.id, { others: ['stem', 'flower'] })],
    });
    expect(rejected).toEqual({});
    expect(scenes[roots.id]).toEqual({
      kind: 'label',
      picture: 'plant',
      tags: [
        { part: 'flower', text: 'flower' },
        { part: 'stem', text: 'stem' },
        { part: 'roots', text: 'roots' },
      ],
      asked: 2,
    });
  });

  it('rejects misfits, wrong parts, hints that name a choice, and missing parts', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => ({ ...roots, id }));
    const { scenes, rejected } = acceptLabels(items, {
      scenes: [
        tagged('a', { fits: false, note: 'about a bird' }),
        tagged('b', { part: 'stem', others: ['flower'] }),
        tagged('c', { others: ['leaf', 'stem'] }),
        tagged('d', { others: ['bark'] }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected).toEqual({
      a: 'does not fit: about a bird',
      b: 'the answer roots does not name stem',
      c: 'the hint leaf names the choice leaves',
      d: 'the plant has no bark',
    });
  });

  it('ignores entries for items it did not ask about', () => {
    expect(acceptLabels([roots], { scenes: [tagged('other')] })).toEqual({
      scenes: {},
      rejected: {},
    });
  });
});

describe('acceptLabels picture guard', () => {
  // Real items whose answer only shares a part's name with a picture.
  const river = tap(
    'g1-soc-community-features-tap-1',
    'Which is natural?',
    'Which one is natural: a river, a school, or a road?',
    ['a school', 'a river', 'a road'],
    1,
  );
  const brain = tap(
    'g1-hlth-food-needs-tap-4',
    'What helps you think?',
    'Which part of you helps you think and learn: your brain, your knee, or your nose?',
    ['your knee', 'your nose', 'your brain'],
    2,
  );

  it('rejects an item that never says what the picture shows, even when the LLM says it fits', () => {
    const { scenes, rejected } = acceptLabels([river, wings], {
      scenes: [
        tagged(river.id, { picture: 'map', part: 'river', others: ['lake', 'forest'] }),
        tagged(wings.id, { picture: 'insect', part: 'wings', others: ['head', 'legs'] }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected).toEqual({
      [river.id]: 'the item never says what the map picture shows',
      [wings.id]: 'the item never says what the insect picture shows',
    });
  });

  it('keeps real fits, with every tag a bare part name', () => {
    const { scenes, rejected } = acceptLabels([roots, brain], {
      scenes: [
        tagged(roots.id),
        tagged(brain.id, { picture: 'organs', part: 'brain', others: ['heart', 'lungs'] }),
      ],
    });
    expect(rejected).toEqual({});
    expect(Object.keys(scenes)).toEqual([roots.id, brain.id]);
    expect(scenes[brain.id]?.tags.map((t) => t.text)).toEqual(['brain', 'lungs', 'heart']);
    expect(scenes[brain.id]?.tags[scenes[brain.id]!.asked]).toEqual({
      part: 'brain',
      text: 'brain',
    });
  });
});

describe('applyLabels', () => {
  it('sets the scene on its item and drops one that no longer fits', () => {
    const { scenes } = acceptLabels([roots], { scenes: [tagged(roots.id)] });
    const changed = { ...roots, choices: [{ id: 'a', kind: 'text', text: 'stem' }] } as Item;
    const bundle = { items: [roots, wings] } as unknown as ContentBundle;
    const applied = applyLabels(bundle, scenes);
    expect(applied.bundle.items[0]!.game).toEqual(scenes[roots.id]);
    expect(applied.dropped).toEqual([]);
    const stale = applyLabels({ items: [changed] } as unknown as ContentBundle, scenes);
    expect(stale.bundle.items[0]!.game).toBeUndefined();
    expect(stale.dropped).toHaveLength(1);
  });
});
