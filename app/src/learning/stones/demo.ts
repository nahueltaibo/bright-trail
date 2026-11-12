import type { Item, StonesScene } from '@bright-trail/shared';

const scene = (stones: string[], missing: number): StonesScene => ({
  kind: 'stones',
  stones,
  missing,
});
const base = { skillId: 'demo-stones', difficulty: 1 } as const;
const tap = (answer: number | string, ...others: (number | string)[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((v, i) =>
    typeof v === 'number'
      ? { id: 'abcd'[i], kind: 'number' as const, value: v }
      : { id: 'abcd'[i], kind: 'text' as const, text: v },
  ),
  answerChoiceId: 'a',
});

/** One item per kind of stones question, for /dev/games/stones. Each must pass `stonesProblems`. */
export const STONES_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-stones-next',
    prompt: '2, 4, 6, ?',
    narration: 'Count by 2s. 2, 4, 6. What comes next? Is it 7, 8, or 9?',
    why: 'Each hop adds 2. 6 and 2 more is 8.',
    ...tap(8, 7, 9),
    game: scene(['2', '4', '6', '8'], 3),
  },
  {
    ...base,
    id: 'demo-stones-down',
    prompt: '5, ?',
    narration: 'Count down from 5. What number comes next?',
    why: 'Counting down, 4 comes after 5.',
    type: 'keypad',
    answer: 4,
    game: scene(['5', '4'], 1),
  },
  {
    ...base,
    id: 'demo-stones-middle',
    prompt: '35, 40, ?, 50',
    narration: 'Count by 5s. 35, 40, then a missing number, then 50. What is the missing number?',
    why: '40 and 5 more is 45, and 45 and 5 more is 50.',
    type: 'keypad',
    answer: 45,
    game: scene(['35', '40', '45', '50'], 2),
  },
  {
    ...base,
    id: 'demo-stones-before',
    prompt: 'Count by 2s. Before 50?',
    narration:
      'Mia counts by 2s and stops at 50. What number is just before 50? Is it 45, 48, or 49?',
    why: '2 less than 50 is 48.',
    ...tap(48, 45, 49),
    game: scene(['48', '50'], 0),
  },
  {
    ...base,
    id: 'demo-stones-thirds',
    prompt: '1/3, 2/3, ...',
    narration: 'Count by thirds: 1/3, 2/3. What comes next? Is it 3/3, 4/3, or 2/4?',
    why: '3 one thirds make 3/3.',
    ...tap('3/3', '4/3', '2/4'),
    game: scene(['1/3', '2/3', '3/3'], 2),
  },
  {
    ...base,
    id: 'demo-stones-long',
    prompt: '10, 20, 30, 40, 50, ?, 70, 80',
    narration: 'Count by 10s: 10, 20, 30, 40, 50, then a missing number, then 70, 80.',
    why: '50 and 10 more is 60.',
    type: 'keypad',
    answer: 60,
    game: scene(['10', '20', '30', '40', '50', '60', '70', '80'], 5),
  },
];
