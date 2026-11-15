import type { Item, WallScene } from '@bright-trail/shared';

const scene = (s: Omit<WallScene, 'kind'>): WallScene => ({ kind: 'wall', ...s });
const base = { skillId: 'demo-wall', difficulty: 1 } as const;
const tap = (answer: string, ...others: string[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((text, i) => ({ id: 'abcd'[i], kind: 'text' as const, text })),
  answerChoiceId: 'a',
});

/** One item per kind of wall question, for /dev/games/wall. Each must pass `wallProblems`. */
export const WALL_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-wall-fill',
    prompt: '1/2 = ?/4',
    narration:
      'The fraction 1/2 is equivalent to a fraction with 4 as the denominator. Type the missing numerator.',
    why: 'To change 2 into 4, multiply by 2. Do the same to the numerator: 1 × 2 = 2.',
    type: 'keypad',
    answer: 2,
    game: scene({ ask: 'fill', than: '1/2', parts: 4 }),
  },
  {
    ...base,
    id: 'demo-wall-fill-twelfths',
    prompt: '2/3 = ?/12',
    narration:
      'The fraction 2/3 is equivalent to a fraction with 12 as the denominator. Type the missing numerator.',
    why: 'To change 3 into 12, multiply by 4. Do the same to the numerator: 2 × 4 = 8.',
    type: 'keypad',
    answer: 8,
    game: scene({ ask: 'fill', than: '2/3', parts: 12 }),
  },
  {
    ...base,
    id: 'demo-wall-fill-wholes',
    prompt: '6/3 = ? wholes',
    narration: 'Dev has 6/3 of a cup of water. That is the same as how many whole cups?',
    why: '3 thirds make 1 whole, so 6 thirds make 2 wholes.',
    type: 'keypad',
    answer: 2,
    game: scene({ ask: 'fill', than: '6/3', parts: 1 }),
  },
  {
    ...base,
    id: 'demo-wall-pass',
    prompt: '?/6 is greater than 1/2',
    narration:
      'A fraction has a denominator of 6. What is the smallest whole number numerator that makes it greater than 1/2?',
    why: 'Half of 6 is 3, so 3/6 equals 1/2. The next numerator, 4, makes 4/6 greater than 1/2.',
    type: 'keypad',
    answer: 4,
    game: scene({ ask: 'pass', than: '1/2', parts: 6 }),
  },
  {
    ...base,
    id: 'demo-wall-more',
    prompt: '11/8 greater than 3/2?',
    narration: 'Is 11/8 greater than 3/2? Yes or no.',
    why: '3/2 is 1 1/2, which is 1 4/8. 11/8 is 1 3/8. Since 3/8 is less than 4/8, 11/8 is not greater.',
    ...tap('No', 'Yes'),
    game: scene({ ask: 'more', than: '3/2', amount: '11/8' }),
  },
  {
    ...base,
    id: 'demo-wall-less',
    prompt: '2/3 less than 3/4?',
    narration: 'Is 2/3 less than 3/4? Yes or no.',
    why: '2/3 is 8/12 and 3/4 is 9/12, so 2/3 is less.',
    ...tap('Yes', 'No'),
    game: scene({ ask: 'less', than: '3/4', amount: '2/3' }),
  },
  {
    ...base,
    id: 'demo-wall-same',
    prompt: 'Is 6/8 the same as 3/4?',
    narration: 'Is 6/8 the same amount as 3/4? Yes or no.',
    why: 'Each fourth is 2 eighths, so 3 fourths are 6 eighths.',
    ...tap('Yes', 'No'),
    game: scene({ ask: 'same', than: '3/4', amount: '6/8' }),
  },
  {
    ...base,
    id: 'demo-wall-relation',
    prompt: '3/8 and 1/2',
    narration: 'Is 3/8 less than 1/2 or more than 1/2?',
    why: 'Half of 8 is 4, so 4/8 equals 1/2. Since 3 is less than 4, 3/8 is less than 1/2.',
    ...tap('less than 1/2', 'more than 1/2'),
    game: scene({ ask: 'relation', than: '1/2', amount: '3/8' }),
  },
  {
    ...base,
    id: 'demo-wall-match',
    prompt: '2 1/3 as an improper fraction',
    narration: 'Which improper fraction equals the mixed number 2 1/3: 5/3, 7/3, 2/3, or 8/3?',
    why: '2 wholes are 6 thirds. 6 thirds and 1 more third make 7/3.',
    ...tap('7/3', '5/3', '2/3', '8/3'),
    game: scene({ ask: 'match', than: '2 1/3' }),
  },
];
