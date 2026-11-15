import { describe, expect, it } from 'vitest';
import type { Item } from './item';
import { LineupSceneSchema, lineupProblems, type LineupScene } from './lineup';

const base = { skillId: 's', difficulty: 1, why: 'w' } as const;
const keypad = (prompt: string, narration: string, answer: number, extra = {}): Item =>
  ({ ...base, id: 'k', prompt, narration, type: 'keypad', answer, ...extra }) as Item;
const line = (prompt: string, narration: string, target: number): Item => ({
  ...base,
  id: 'n',
  prompt,
  narration,
  type: 'number-line',
  min: 0,
  max: 10,
  step: 1,
  target,
});
const scene = (over: Partial<LineupScene> = {}): LineupScene => ({
  kind: 'lineup',
  line: ['frog', 'frog', 'frog', 'frog', 'frog'],
  place: 3,
  ask: 'find',
  ...over,
});

const third = line('Third is 3', 'A frog is third in line. Hop the frog to 3.', 3);

describe('LineupSceneSchema', () => {
  it('keeps the place inside the line', () => {
    expect(LineupSceneSchema.safeParse(scene()).success).toBe(true);
    const past = LineupSceneSchema.safeParse(scene({ place: 6 }));
    expect(past.error?.issues[0].message).toBe('place is past the end of the line');
  });

  it('takes 2 to 8 in line', () => {
    expect(LineupSceneSchema.safeParse(scene({ line: ['cat'], place: 1 })).success).toBe(false);
    const nine = Array.from({ length: 9 }, () => 'kid' as const);
    expect(LineupSceneSchema.safeParse(scene({ line: nine })).success).toBe(false);
  });
});

describe('lineupProblems', () => {
  it('passes a line that asks for the item answer', () => {
    expect(lineupProblems(third, scene())).toEqual([]);
  });

  it('needs the place to be the answer', () => {
    expect(lineupProblems(third, scene({ place: 2 }))).toContain(
      'the line asks about place 2 but the item answers 3',
    );
  });

  it('needs the item to name the one in that place and say its place', () => {
    const ana = line('Seventh place', 'Ana is seventh in line. Hop the frog to her place.', 7);
    const kids = Array.from({ length: 8 }, () => 'kid' as const);
    expect(lineupProblems(ana, scene({ line: kids, place: 7, name: 'Ana' }))).toEqual([]);
    expect(lineupProblems(ana, scene({ line: kids, place: 7, name: 'Sam' }))).toContain(
      'the item never names Sam',
    );
    const cats = Array.from({ length: 8 }, () => 'cat' as const);
    expect(lineupProblems(ana, scene({ line: cats, place: 7 }))).toContain(
      'the item never names the cat',
    );
    const unsaid = line('3', 'A frog is in line. Hop the frog to 3.', 3);
    expect(lineupProblems(unsaid, scene())).toContain('the item never says third');
  });

  it('takes "last" for the last place', () => {
    const ducks = keypad(
      'Last duck?',
      'Five ducks stand in a line. What place is the last duck in?',
      5,
      {
        visual: { kind: 'objects', emoji: '🦆', count: 5 },
      },
    );
    const five = scene({ line: ['duck', 'duck', 'duck', 'duck', 'duck'], place: 5, ask: 'place' });
    expect(lineupProblems(ducks, five)).toEqual([]);
    // With a sixth duck, the fifth is no longer last, and the picture no longer matches.
    expect(lineupProblems(ducks, { ...five, line: [...five.line, 'duck'] })).toEqual([
      'the item never says fifth',
      'the picture shows 5 but the line has 6',
    ]);
  });

  it('asks a tap item for the place, never to find one', () => {
    const cat: Item = {
      ...base,
      id: 't',
      prompt: 'Second place',
      narration: "The cat is second in line. Is the cat's place 4, 1, 3, or 2?",
      type: 'tap',
      choices: [1, 2, 3, 4].map((v, i) => ({ id: 'abcd'[i], kind: 'number' as const, value: v })),
      answerChoiceId: 'b',
    };
    const animals: LineupScene = scene({ line: ['dog', 'cat', 'bunny', 'bear'], place: 2 });
    expect(lineupProblems(cat, { ...animals, ask: 'place' })).toEqual([]);
    expect(lineupProblems(cat, animals)).toEqual([
      'a tap item answers from its choices, so it asks for the place',
    ]);
  });
});
