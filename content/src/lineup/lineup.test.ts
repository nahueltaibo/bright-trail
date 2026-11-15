import type { ContentBundle, Item, LineupScene } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { acceptLineups, applyLineups, lineupCandidates, type TaggedLineup } from './lineup';

const base = { skillId: 's', difficulty: 1, why: 'w' } as const;
const keypad = (id: string, prompt: string, narration: string, answer: number): Item => ({
  ...base,
  id,
  prompt,
  narration,
  type: 'keypad',
  answer,
});
const numberLine = (id: string, prompt: string, narration: string, target: number): Item => ({
  ...base,
  id,
  prompt,
  narration,
  type: 'number-line',
  min: 0,
  max: 10,
  step: 1,
  target,
});
const tap = (id: string, prompt: string, narration: string, answer: string): Item => ({
  ...base,
  id,
  prompt,
  narration,
  type: 'tap',
  choices: [
    { id: 'a', kind: 'text', text: answer },
    { id: 'b', kind: 'text', text: 'how many' },
  ],
  answerChoiceId: 'a',
});

const tagged = (itemId: string, over: Partial<TaggedLineup> = {}): TaggedLineup => ({
  itemId,
  fits: true,
  line: ['frog', 'frog', 'frog', 'frog', 'frog'],
  place: 3,
  ask: 'find',
  name: '',
  note: '',
  ...over,
});

const third = numberLine('third', 'Third is 3', 'A frog is third in line. Hop the frog to 3.', 3);
const ana = numberLine('ana', 'Seventh place', 'Ana is seventh in line. Hop the frog to 7.', 7);

describe('lineupCandidates', () => {
  it('keeps places in a line with a whole answer the line can hold', () => {
    const meaning = tap(
      'meaning',
      'Sam is first',
      'Sam is first in line. What does first mean?',
      'which one',
    );
    const greatest = keypad(
      'greatest',
      'Second greatest',
      'Put 372 and 327 in order. What number is second?',
      372,
    );
    const fraction = numberLine(
      'fourths',
      '7/4 - 3/4',
      'The number line goes from 0 to 2 in steps of one fourth. Move the frog to 7/4 - 3/4.',
      1,
    );
    const count = keypad('count', 'How many fish?', 'Count the fish.', 6);
    const played = {
      ...third,
      id: 'played',
      game: { kind: 'stones', stones: ['1', '2', '3'], missing: 2 },
    } as Item;
    expect(
      lineupCandidates([third, ana, meaning, greatest, fraction, count, played]).map((i) => i.id),
    ).toEqual(['third', 'ana']);
  });
});

describe('acceptLineups', () => {
  it('keeps line-ups that ask for the answer and rejects the rest with a reason', () => {
    const result = acceptLineups([third, ana], {
      scenes: [
        tagged('third'),
        tagged('ana', { line: Array(8).fill('kid'), place: 7, name: 'Ana' }),
        tagged('unknown'),
      ],
    });
    expect(Object.keys(result.scenes)).toEqual(['third', 'ana']);
    expect(result.scenes.ana).toEqual({
      kind: 'lineup',
      line: Array(8).fill('kid'),
      place: 7,
      ask: 'find',
      name: 'Ana',
    });
    expect(result.scenes.third).not.toHaveProperty('name');
  });

  it('reports line-ups that do not fit, break the schema, or miss the answer', () => {
    const result = acceptLineups([third, ana], {
      scenes: [tagged('third', { place: 2 }), tagged('ana', { place: 7 })],
    });
    expect(result.rejected.third).toMatch(/asks about place 2 but the item answers 3/);
    expect(result.rejected.ana).toBe('place is past the end of the line');
    const skipped = acceptLineups([third], {
      scenes: [tagged('third', { fits: false, note: 'no line' })],
    });
    expect(skipped.rejected.third).toBe('does not fit: no line');
  });
});

describe('applyLineups', () => {
  it('drops a stored line-up once its item changes', () => {
    const scene: LineupScene = {
      kind: 'lineup',
      line: Array(5).fill('frog'),
      place: 3,
      ask: 'find',
    };
    const bundle = {
      items: [third, { ...third, id: 'other', target: 4 }],
    } as unknown as ContentBundle;
    const { bundle: out, dropped } = applyLineups(bundle, { third: scene, other: scene });
    expect(out.items[0].game).toEqual(scene);
    expect(out.items[1].game).toBeUndefined();
    expect(dropped).toEqual(['other: the line asks about place 3 but the item answers 4']);
  });
});
