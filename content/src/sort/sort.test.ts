import type { ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptSorts, applySorts, sortCandidates, type TaggedSort } from './sort';

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

// Real science and social studies items from the Grade 1 and 2 bundles.
const brick = tap(
  'g2-sci-liquid-or-solid-tap-5',
  'A brick is a...',
  'A brick is used to build walls. Is a brick a liquid or a solid?',
  ['liquid', 'solid'],
  1,
);
const worship = tap(
  'g1-soc-community-features-tap-10',
  'Natural or built?',
  'A place of worship is where people gather to pray. Is it natural or built?',
  ['natural', 'built'],
  1,
);
const trueFalse = tap(
  'g1-sci-basic-needs-tap-2',
  'Living things need air.',
  'True or false: living things need air.',
  ['true', 'false'],
);
const four = tap(
  'g1-sci-plant-animal-features-tap-13',
  'Which is not a plant part?',
  'Which one is not a plant part: roots, leaves, wings, or stem?',
  ['wings', 'roots', 'leaves', 'stem'],
);

const card = (text: string, emoji: string | null = null) => ({ text, emoji });
const tagged = (itemId: string, over: Partial<TaggedSort> = {}): TaggedSort => ({
  itemId,
  fits: true,
  bins: [card('liquid', '💧'), card('solid', '🧱')],
  card: card('brick', '🧱'),
  sorted: [
    { ...card('milk', '🥛'), bin: 'liquid' },
    { ...card('rock', ''), bin: 'Solid' },
  ],
  note: '',
  ...over,
});

describe('sortCandidates', () => {
  it('keeps text tap items with 2 or 3 choices, and skips true or false, pictures, and games', () => {
    const picture = { ...worship, id: 'picture', visual: { kind: 'emoji', emoji: '🛣️' } } as Item;
    const taken = { ...brick, id: 'taken', game: { kind: 'order' } } as unknown as Item;
    expect(
      sortCandidates([brick, worship, trueFalse, four, picture, taken]).map((i) => i.id),
    ).toEqual([brick.id, worship.id]);
  });
});

describe('acceptSorts', () => {
  it('turns bin names into indexes and puts the card in the answer bin, without its bin emoji', () => {
    const { scenes, rejected } = acceptSorts([brick], { scenes: [tagged(brick.id)] });
    expect(rejected).toEqual({});
    expect(scenes[brick.id]).toEqual({
      kind: 'sort',
      bins: [
        { text: 'liquid', emoji: '💧' },
        { text: 'solid', emoji: '🧱' },
      ],
      sorted: [
        { card: { text: 'milk', emoji: '🥛' }, bin: 0 },
        { card: { text: 'rock' }, bin: 1 },
      ],
      card: { text: 'brick' },
      bin: 1,
    });
  });

  it('rejects misfits, unknown bins, bins that are not the choices, and unsaid cards', () => {
    const items = ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => ({ ...brick, id }));
    const { scenes, rejected } = acceptSorts(items, {
      scenes: [
        tagged('a', { fits: false, note: 'choices are things' }),
        tagged('b', { sorted: [{ ...card('steam'), bin: 'gas' }] }),
        tagged('c', { bins: [card('liquid'), card('solid'), card('gas')] }),
        tagged('d', { card: card('wall brick') }),
        tagged('e', { card: card('Solid') }),
        tagged('f', { sorted: [{ ...card('liquid'), bin: 'liquid' }] }),
      ],
    });
    expect(scenes).toEqual({});
    expect(rejected).toEqual({
      a: 'does not fit: choices are things',
      b: 'no bin gas',
      c: 'no choice for the bin gas',
      d: 'the item never says wall brick',
      e: 'the card Solid is a bin',
      f: 'the card liquid is a bin',
    });
  });
});

describe('applySorts', () => {
  it('sets the scene on its item and drops one that no longer fits', () => {
    const { scenes } = acceptSorts([worship], {
      scenes: [
        tagged(worship.id, {
          bins: [card('natural', '🌳'), card('built', '🏗️')],
          card: card('place of worship', '⛪'),
          sorted: [
            { ...card('lake'), bin: 'natural' },
            { ...card('road'), bin: 'built' },
          ],
        }),
      ],
    });
    const applied = applySorts({ items: [worship, brick] } as unknown as ContentBundle, scenes);
    expect(applied.bundle.items[0]!.game).toEqual(scenes[worship.id]);
    const changed = { ...worship, narration: 'Is a church natural or built?' } as Item;
    const stale = applySorts({ items: [changed] } as unknown as ContentBundle, scenes);
    expect(stale.bundle.items[0]!.game).toBeUndefined();
    expect(stale.dropped).toEqual([`${worship.id}: the item never says place of worship`]);
  });
});
