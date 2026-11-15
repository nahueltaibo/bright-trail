import { gameProblems, JoinSceneSchema } from '@bright-trail/shared';
import { boardOf, STAGE_H, STAGE_W, trayOf, TWO_FRAME_CELL, type Box, type Pt } from './board';
import { JOIN_DEMO_ITEMS } from './demo';
import { joinWords } from './words';

const demo = (id: string) => {
  const game = JOIN_DEMO_ITEMS.find((i) => i.id === `demo-join-${id}`)!.game;
  if (game?.kind !== 'join') throw new Error(`demo-join-${id} has no join game`);
  return game;
};
const lowest = (ys: { y: number }[]) => Math.max(...ys.map((c) => c.y));
const square = (p: Pt, size: number): Box => ({
  x: p.x - size / 2,
  y: p.y - size / 2,
  w: size,
  h: size,
});
// A counting bubble as BubbleView draws it on web: its top 16 above the anchor, 33 high, and
// 26 to 30 wide for one digit.
const countBubble = (at: Pt, n: number): Box => {
  const w = n < 10 ? 30 : 40;
  return { x: at.x - w / 2, y: at.y - 16, w, h: 34 };
};
const overlap = (a: Box, b: Box) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const inside = (a: Box) => a.x >= 0 && a.y >= 0 && a.x + a.w <= STAGE_W && a.y + a.h <= STAGE_H;

describe('demo items', () => {
  it.each(JOIN_DEMO_ITEMS.map((i) => [i.id, i] as const))('%s matches its scene', (_, item) => {
    expect(item.game?.kind).toBe('join');
    expect(gameProblems(item, item.game!)).toEqual([]);
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

describe('a part past 10', () => {
  const cases: [number, number][] = [];
  for (let start = 11; start <= 20; start++)
    for (let take = 1; take <= 10; take++) cases.push([start, take]);

  it.each(cases)('%i with %i set aside keeps things, frames, and counts apart', (start, take) => {
    const b = boardOf(
      JoinSceneSchema.parse({
        kind: 'join',
        ask: 'part',
        one: 'dot',
        many: 'dots',
        place: 'tray',
        move: 'slide',
        start,
        take,
      }),
    );
    expect(b.frames).toBe(2);
    // The tray's 2px stroke reaches 1 past its box.
    const trays = [b.cells.slice(0, 10), b.cells.slice(10)]
      .map((c) => trayOf(c, TWO_FRAME_CELL))
      .map((t) => ({ x: t.x - 1, y: t.y - 1, w: t.w + 2, h: t.h + 2 }));
    const things = b.aside.map((p) => square(p, b.asideSize));
    const counts = b.aside.map((p, i) => countBubble({ x: p.x, y: p.y - b.asideLift }, i + 1));
    expect(things).toHaveLength(take);
    for (const box of [...trays, ...things, ...counts, b.mat!]) expect(inside(box)).toBe(true);
    things.forEach((thing, i) => {
      for (const tray of trays) {
        expect(overlap(thing, tray)).toBe(false);
        expect(overlap(counts[i], tray)).toBe(false);
      }
      for (let j = 0; j < take; j++) {
        if (j === i) continue;
        expect(overlap(thing, things[j])).toBe(false);
        expect(overlap(counts[i], things[j])).toBe(false);
        expect(overlap(counts[i], counts[j])).toBe(false);
      }
      // A count may touch the top of its own thing, but not hide it.
      expect(counts[i].y + counts[i].h).toBeLessThanOrEqual(thing.y + thing.h / 4);
    });
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
