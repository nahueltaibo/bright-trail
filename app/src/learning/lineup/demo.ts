import type { Item, LineThing, LineupScene } from '@bright-trail/shared';

const scene = (
  line: LineThing[],
  place: number,
  ask: LineupScene['ask'],
  name?: string,
): LineupScene => ({ kind: 'lineup', line, place, ask, ...(name && { name }) });
const base = { skillId: 'demo-lineup', difficulty: 1 } as const;
const all = (thing: LineThing, n: number) => Array.from({ length: n }, () => thing);

/** One item per kind of line-up question, for /dev/games/lineup. Each must pass `lineupProblems`. */
export const LINEUP_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-lineup-find',
    prompt: 'Third is 3',
    narration: 'A frog is third in line. Hop the frog to 3.',
    why: 'First is 1, second is 2, and third is 3. Hop to 3.',
    type: 'number-line',
    min: 0,
    max: 10,
    step: 1,
    target: 3,
    game: scene(all('frog', 5), 3, 'find'),
  },
  {
    ...base,
    id: 'demo-lineup-name',
    prompt: 'Seventh place',
    narration: 'Ana is seventh in line. Hop the frog to the number for her place.',
    why: 'Seventh means the place after sixth. Count to 7 and hop there.',
    type: 'number-line',
    min: 0,
    max: 10,
    step: 1,
    target: 7,
    game: scene(all('kid', 8), 7, 'find', 'Ana'),
  },
  {
    ...base,
    id: 'demo-lineup-choices',
    prompt: 'Second place',
    narration: "The cat is second in line. Is the cat's place 4, 1, 3, or 2?",
    why: 'First is 1. Second comes next, so second is 2.',
    type: 'tap',
    choices: [4, 1, 3, 2].map((value, i) => ({ id: 'abcd'[i], kind: 'number' as const, value })),
    answerChoiceId: 'd',
    game: scene(['dog', 'cat', 'bunny', 'bear', 'duck'], 2, 'place'),
  },
  {
    ...base,
    id: 'demo-lineup-last',
    prompt: "Last duck's place?",
    narration:
      'Five ducks stand in a line. The first duck is in place 1. What place is the last duck in? Type its place number.',
    why: 'Count the ducks in line. The last duck matches that count.',
    type: 'keypad',
    answer: 5,
    game: scene(all('duck', 5), 5, 'place'),
  },
];
