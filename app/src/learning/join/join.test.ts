import { joinProblems } from '@bright-trail/shared';
import { boardOf } from './board';
import { JOIN_DEMO_ITEMS } from './demo';
import { joinWords } from './words';

const demo = (id: string) => JOIN_DEMO_ITEMS.find((i) => i.id === `demo-join-${id}`)!.join!;
const lowest = (ys: { y: number }[]) => Math.max(...ys.map((c) => c.y));

describe('demo items', () => {
  it.each(JOIN_DEMO_ITEMS.map((i) => [i.id, i] as const))('%s matches its scene', (_, item) => {
    expect(joinProblems(item, item.join!)).toEqual([]);
  });
});

describe('boardOf', () => {
  it('fills left to right, top row first', () => {
    const b = boardOf(demo('fill'));
    expect(b.frames).toBe(1);
    expect(b.cells[1].x).toBeGreaterThan(b.cells[0].x);
    expect(b.cells[5].y).toBeGreaterThan(b.cells[4].y);
    expect(b.cells[5].x).toBe(b.cells[0].x);
  });

  it('stacks a second frame past 10', () => {
    const b = boardOf(demo('back'));
    expect(b.frames).toBe(2);
    expect(b.cells).toHaveLength(20);
    expect(b.cells[10].y).toBeGreaterThan(b.cells[9].y);
  });

  it('piles things below the frame for a count, and sets aside below it for a part', () => {
    const count = boardOf(demo('count'));
    expect(count.pile).toHaveLength(5);
    for (const p of count.pile) expect(p.y).toBeGreaterThan(lowest(count.cells));
    const part = boardOf(demo('part'));
    expect(part.aside).toHaveLength(4);
    expect(part.aside[0].y).toBeGreaterThan(lowest(part.cells));
  });
});

describe('joinWords', () => {
  it('says what the play-out showed', () => {
    expect(joinWords(demo('fly')).equation).toBe('9 − 5 = 4');
    expect(joinWords(demo('part')).summary).toBe('5 is 4 and 1.');
    expect(joinWords(demo('make-ten')).summary).toBe('Move 1 up to make 10. 10 and 4 make 14.');
    expect(joinWords(demo('count')).summary).toBe('There are 5 frogs.');
  });
});
