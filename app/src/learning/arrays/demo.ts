import type { ArrayScene, Item } from '@bright-trail/shared';

const scene = (s: Omit<ArrayScene, 'kind'>): ArrayScene => ({ kind: 'arrays', ...s });
const base = { skillId: 'demo-arrays', difficulty: 1 } as const;
const tap = (answer: number, ...others: number[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((value, i) => ({
    id: 'abcd'[i],
    kind: 'number' as const,
    value,
  })),
  answerChoiceId: 'a',
});

/** One item per kind of array question, for /dev/games/arrays. Each must pass `arrayProblems`. */
export const ARRAYS_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-arrays-total',
    prompt: '3 rows of 4',
    narration: 'An array has 3 rows with 4 dots in each row. How many dots in all?',
    why: 'Count by fours 3 times: 4, 8, 12.',
    ...tap(12, 7, 10, 15),
    game: scene({ ask: 'total', rows: 3, columns: 4 }),
  },
  {
    ...base,
    id: 'demo-arrays-rows',
    prompt: '12 ÷ 4 = ?',
    narration: 'An array has 12 stars. There are 4 stars in each row. How many rows are there?',
    why: 'Count by fours until you reach 12: 4, 8, 12. That took 3 rows.',
    type: 'keypad',
    answer: 3,
    game: scene({ ask: 'rows', rows: 3, columns: 4, thing: 'star' }),
  },
  {
    ...base,
    id: 'demo-arrays-columns',
    prompt: '24 ÷ 6 = ?',
    narration: 'Leo lines up 24 cookies in 6 equal rows. How many cookies are in each row?',
    why: 'Since 6 × 4 = 24, each row has 4.',
    ...tap(4, 3, 6, 18),
    game: scene({ ask: 'columns', rows: 6, columns: 4, thing: 'cookie' }),
  },
  {
    ...base,
    id: 'demo-arrays-turn',
    prompt: '3 × 5 = 5 × ?',
    narration: '3 × 5 is the same as 5 × what number?',
    why: 'You can multiply in any order. 3 × 5 and 5 × 3 both make 15.',
    ...tap(3, 5, 8, 15),
    game: scene({ ask: 'turn', rows: 3, columns: 5, find: 'rows' }),
  },
  {
    ...base,
    id: 'demo-arrays-split',
    prompt: '8 × 7 = ?',
    narration: 'Lena wants 8 × 7. She uses 8 × 5 = 40 and 8 × 2 = 16. What is 8 × 7?',
    why: 'Split 7 into 5 and 2. Then 40 + 16 = 56.',
    type: 'keypad',
    answer: 56,
    game: scene({
      ask: 'split',
      rows: 8,
      columns: 7,
      find: 'total',
      split: { by: 'columns', at: 5 },
    }),
  },
  {
    ...base,
    id: 'demo-arrays-big',
    prompt: '10 × 10 = ?',
    narration: 'What is 10 × 10?',
    why: 'Ten rows of 10 make 100.',
    type: 'keypad',
    answer: 100,
    game: scene({ ask: 'total', rows: 10, columns: 10 }),
  },
];
