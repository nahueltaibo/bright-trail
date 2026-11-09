import type { Hops, Item, NumberLineItem } from '@bright-trail/shared';

const line = (
  id: string,
  narration: string,
  why: string,
  l: Pick<NumberLineItem, 'min' | 'max' | 'step' | 'target'>,
  hops?: Hops,
): Item => ({
  id: `demo-hops-${id}`,
  skillId: 'demo-hops',
  difficulty: 1,
  narration,
  prompt: narration,
  why,
  type: 'number-line',
  ...l,
  ...(hops && { hops }),
});

/** One number-line item per kind of hop path, for /dev/hops. Each must pass `hopsProblems`. */
export const HOPS_DEMO_ITEMS: Item[] = [
  line(
    'count-on',
    'Mia has 3 apples. She gets 2 more. Hop the frog to how many apples she has.',
    'Start at 3 and hop 2 more: 4, 5. Mia has 5 apples.',
    { min: 0, max: 10, step: 1, target: 5 },
    { start: 3, legs: [{ by: 1, times: 2 }] },
  ),
  line(
    'back',
    'The frog starts at 20. It hops back 6. Drag the frog to where it lands.',
    'Hop back 6 from 20: 19, 18, 17, 16, 15, 14.',
    { min: 0, max: 30, step: 1, target: 14 },
    { start: 20, legs: [{ by: -1, times: 6 }] },
  ),
  line(
    'skip',
    'Frog hops 5 at a time. It makes 7 hops from 0. Move the frog to where it lands.',
    'Count by 5s, one for each hop: 5, 10, 15, 20, 25, 30, 35.',
    { min: 0, max: 40, step: 5, target: 35 },
    { start: 0, legs: [{ by: 5, times: 7 }] },
  ),
  line('big', 'Move the frog to 165.', '165 is 3 jumps of 50, then 3 hops of 5.', {
    min: 0,
    max: 200,
    step: 5,
    target: 165,
  }),
  line(
    'fraction',
    'Move the frog to 3/4 on the number line.',
    'The line from 0 to 1 is cut into 4 equal steps. 3 steps of 1/4 make 3/4.',
    { min: 0, max: 1, step: 0.25, target: 0.75 },
  ),
  line(
    'decimal',
    'This number line goes from 0 to 2. Move the frog to 1.4.',
    '1.4 is 1 whole and 4 tenths: one big hop to 1, then 4 small hops.',
    { min: 0, max: 2, step: 0.1, target: 1.4 },
  ),
];
