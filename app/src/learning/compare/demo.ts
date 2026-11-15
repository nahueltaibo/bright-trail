import type { CompareScene, Item } from '@bright-trail/shared';

const scene = (s: Omit<CompareScene, 'kind'>): CompareScene => ({ kind: 'compare', ...s });
const base = { skillId: 'demo-compare', difficulty: 1 } as const;
const tap = (answer: number | string, ...others: (number | string)[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((v, i) =>
    typeof v === 'number'
      ? { id: 'abcd'[i], kind: 'number' as const, value: v }
      : { id: 'abcd'[i], kind: 'text' as const, text: v },
  ),
  answerChoiceId: 'a',
});

/** One item per kind of compare question, for /dev/games/compare. Each must pass `compareProblems`. */
export const COMPARE_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-compare-towers',
    prompt: 'Which is greater?',
    narration: 'Which number is greater, 9 or 12?',
    why: 'Build a tower for each number. The 12 tower is taller, so 12 is greater.',
    ...tap(12, 9),
    game: scene({ ask: 'greatest', values: ['9', '12'] }),
  },
  {
    ...base,
    id: 'demo-compare-towers-least',
    prompt: 'Which is least?',
    narration: 'Which number is least, 7, 3, or 5?',
    why: 'The 3 tower is the shortest, so 3 is least.',
    ...tap(3, 7, 5),
    game: scene({ ask: 'least', values: ['7', '3', '5'] }),
  },
  {
    ...base,
    id: 'demo-compare-line',
    prompt: 'Which is greatest?',
    narration: 'Which number is greatest: 899, 989, 898, or 998?',
    why: 'Compare the hundreds first. 998 is farthest right on the number line.',
    ...tap(998, 899, 989, 898),
    game: scene({ ask: 'greatest', values: ['899', '989', '898', '998'] }),
  },
  {
    ...base,
    id: 'demo-compare-fractions',
    prompt: 'Which is less?',
    narration: 'Which is less, 5/6 or 3/8?',
    why: '3/8 is less than one half and 5/6 is more, so 3/8 is less.',
    ...tap('3/8', '5/6'),
    game: scene({ ask: 'least', values: ['5/6', '3/8'] }),
  },
  {
    ...base,
    id: 'demo-compare-decimals',
    prompt: 'Which is greater?',
    narration: 'Which is greater, 0.6 or 0.06?',
    why: '0.6 has 6 tenths. 0.06 has only 6 hundredths.',
    ...tap(0.6, 0.06),
    game: scene({ ask: 'greatest', values: ['0.6', '0.06'] }),
  },
  {
    ...base,
    id: 'demo-compare-middle',
    prompt: 'Middle number?',
    narration: 'Put 120, 87, and 150 in order from least to greatest. Type the middle number.',
    why: 'In order they go 87, 120, 150. 120 is in the middle.',
    type: 'keypad',
    answer: 120,
    game: scene({ ask: 'middle', values: ['120', '87', '150'] }),
  },
  {
    ...base,
    id: 'demo-compare-closer',
    prompt: '190 is closer to?',
    narration: 'Is 190 closer to 100 or closer to 200?',
    why: '190 is 10 away from 200 and 90 away from 100.',
    ...tap(200, 100),
    game: scene({ ask: 'closer', values: ['100', '200'], target: '190' }),
  },
  {
    ...base,
    id: 'demo-compare-same',
    prompt: '4 and 4',
    narration: 'Pip has 4 apples. Mia has 4 apples. Is it more, less, or the same?',
    why: 'Both towers have 4 cubes, so they are the same.',
    ...tap('the same', 'more', 'less'),
    game: scene({ ask: 'relation', values: ['4', '4'] }),
  },
  {
    ...base,
    id: 'demo-compare-relation',
    prompt: '462 and 500',
    narration: 'Is 462 greater than 500 or less than 500?',
    why: '462 has 4 hundreds and 500 has 5, so 462 is less.',
    ...tap('less than 500', 'greater than 500'),
    game: scene({ ask: 'relation', values: ['462', '500'] }),
  },
  {
    ...base,
    id: 'demo-compare-claim',
    prompt: '11/8 greater than 3/2?',
    narration: 'Is 11/8 greater than 3/2? Yes or no.',
    why: '3/2 is 12/8, and 11/8 is less than 12/8.',
    ...tap('No', 'Yes'),
    game: scene({ ask: 'relation', values: ['11/8', '3/2'], claim: 'more' }),
  },
];
