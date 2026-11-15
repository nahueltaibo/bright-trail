import type { GridScene, Item } from '@bright-trail/shared';

const scene = (s: Omit<GridScene, 'kind'>): GridScene => ({ kind: 'grid', ...s });
const base = { skillId: 'demo-grid', difficulty: 1 } as const;
const tap = (answer: number | string, ...others: (number | string)[]) => ({
  type: 'tap' as const,
  choices: [answer, ...others].map((v, i) =>
    typeof v === 'number'
      ? { id: 'abcd'[i], kind: 'number' as const, value: v }
      : { id: 'abcd'[i], kind: 'text' as const, text: v },
  ),
  answerChoiceId: 'a',
});

/** One item per kind of grid question, for /dev/games/grid. Each must pass `gridProblems`. */
export const GRID_DEMO_ITEMS: Item[] = [
  {
    ...base,
    id: 'demo-grid-decimal',
    prompt: '9 tenths = ?',
    narration: 'Type the decimal for 9 tenths.',
    why: '9 tenths is written 0.9.',
    type: 'keypad',
    answer: 0.9,
    game: scene({ unit: 'tenths', ask: 'decimal', amount: '9/10' }),
  },
  {
    ...base,
    id: 'demo-grid-decimal-choices',
    prompt: '1/2 = ?',
    narration: 'Which decimal is the same as 1/2: 0.2, 0.5, or 1.5?',
    why: 'Half of the strip is 5 tenths, or 0.5.',
    ...tap(0.5, 0.2, 1.5),
    game: scene({ unit: 'tenths', ask: 'decimal', amount: '1/2' }),
  },
  {
    ...base,
    id: 'demo-grid-wholes',
    prompt: 'Laps as a decimal',
    narration: 'Mia ran 2 whole laps and 7 tenths of another lap. Type her distance as a decimal.',
    why: '2 wholes and 7 tenths is 2.7.',
    type: 'keypad',
    answer: 2.7,
    game: scene({ unit: 'tenths', ask: 'decimal', amount: '2 7/10' }),
  },
  {
    ...base,
    id: 'demo-grid-fraction',
    prompt: '0.4 = ?',
    narration: 'Which fraction is the same as 0.4: 1/10, 4/10, or 6/10?',
    why: '0.4 is 4 tenths, or 4/10.',
    ...tap('4/10', '1/10', '6/10'),
    game: scene({ unit: 'tenths', ask: 'fraction', amount: '0.4' }),
  },
  {
    ...base,
    id: 'demo-grid-percent',
    prompt: '3/4 = ?%',
    narration: 'What percent is equal to 3/4? Is it 25%, 34%, or 75%?',
    why: '3/4 of a hundred grid is 75 squares, or 75%.',
    ...tap('75%', '25%', '34%'),
    game: scene({ unit: 'hundredths', ask: 'percent', amount: '3/4' }),
  },
  {
    ...base,
    id: 'demo-grid-parts',
    prompt: '0.3 = ? hundredths',
    narration: 'The decimal 0.3 is the same as how many hundredths? Type the number.',
    why: '3 tenths fill 3 columns of 10, which is 30 hundredths.',
    type: 'keypad',
    answer: 30,
    game: scene({ unit: 'hundredths', ask: 'parts', amount: '0.3' }),
  },
  {
    ...base,
    id: 'demo-grid-same',
    prompt: '7/10 = 0.07?',
    narration: 'Is 7/10 the same amount as 0.07? Yes or no?',
    why: '7/10 is 70 hundredths. 0.07 is only 7 hundredths.',
    ...tap('No', 'Yes'),
    game: scene({ unit: 'hundredths', ask: 'same', amount: '7/10', other: '0.07' }),
  },
  {
    ...base,
    id: 'demo-grid-ten-frame',
    prompt: 'Type the decimal',
    narration:
      'A ten-frame is one whole. Four dots are filled. Type the decimal for the filled part.',
    why: '4 of 10 parts are filled. That is 4 tenths, or 0.4.',
    type: 'keypad',
    visual: { kind: 'ten-frame', filled: 4 },
    answer: 0.4,
    game: scene({ unit: 'tenths', ask: 'decimal', amount: '4/10' }),
  },
  {
    ...base,
    id: 'demo-grid-line',
    prompt: 'Find 3/10',
    narration: 'Move the frog to 3/10 on the number line.',
    why: '3/10 is 3 tenths, or 0.3.',
    type: 'number-line',
    min: 0,
    max: 1,
    step: 0.1,
    target: 0.3,
    game: scene({ unit: 'tenths', ask: 'decimal', amount: '3/10' }),
  },
];
