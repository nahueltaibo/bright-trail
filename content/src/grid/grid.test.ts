import type { Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { gridCandidates } from './grid';

const base = { skillId: 's', difficulty: 1, why: 'w' } as const;
const keypad = (id: string, prompt: string, narration: string, answer: number): Item => ({
  ...base,
  id,
  prompt,
  narration,
  type: 'keypad',
  answer,
});
const line = (id: string, prompt: string, target: number): Item => ({
  ...base,
  id,
  prompt,
  narration: `Move the frog to ${prompt.replace(/^(Find|Go to) /, '')} on the number line.`,
  type: 'number-line',
  min: 0,
  max: 3,
  step: 0.1,
  target,
});

describe('gridCandidates', () => {
  it('takes decimal words, ten-frames, and number lines that convert an amount', () => {
    const tenths = keypad('tenths', '9 tenths = ?', 'Type the decimal for 9 tenths.', 0.9);
    const frame = {
      ...keypad('frame', 'Type the decimal', 'Four dots are filled. Type the decimal.', 0.4),
      visual: { kind: 'ten-frame', filled: 4 },
    } as Item;
    const objects = {
      ...keypad('objects', 'Type the decimal', 'Four apples. Type the decimal.', 0.4),
      visual: { kind: 'objects', emoji: '🍎', count: 4 },
    } as Item;
    const find = line('find', 'Find 3/10', 0.3);
    const percent = line('percent', '7/20 = ?%', 35);
    const placed = line('placed', 'Go to 0.5', 0.5);
    const sum = line('sum', 'Move the frog to 1/4 + 2/4', 0.75);
    const twelfths = line('twelfths', 'Find 9/12', 0.75);
    const other = { ...find, id: 'other', game: { kind: 'hops' } } as unknown as Item;
    const items = [tenths, frame, objects, find, percent, placed, sum, twelfths];
    expect(gridCandidates(items).map((i) => i.id)).toEqual(['tenths', 'frame', 'find', 'percent']);
    expect(gridCandidates([other])).toEqual([]);
  });
});
