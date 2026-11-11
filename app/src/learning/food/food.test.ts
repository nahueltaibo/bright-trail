import { gameProblems } from '@bright-trail/shared';
import { SLICE_DEMO_ITEMS } from './demo';
import { biteRows, outward, pickOffset, wholeOf } from './geometry';
import { pointDown, sliceLayout, sliceUnit } from './layout';
import { sliceSummary } from './SliceGame';

const sliceDemo = (id: string) => {
  const game = SLICE_DEMO_ITEMS.find((i) => i.id === id)!.game;
  if (game?.kind !== 'slices') throw new Error(`${id} has no slices game`);
  return game;
};

describe('pickOffset', () => {
  it('slides one round slice along its own center line', () => {
    const w = wholeOf('circle', 4, 200, 200);
    const off = pickOffset(w, new Set([1]), new Set());
    // Slice 1 runs from three to six o'clock, so it leaves down and to the right.
    expect(off.x).toBeGreaterThan(0);
    expect(off.y).toBeGreaterThan(0);
    expect(Math.abs(off.x - off.y)).toBeLessThan(1e-9);
  });

  it('moves a picked group away from the slices that stay', () => {
    const w = wholeOf('rectangle', 8, 400, 200);
    const off = pickOffset(w, new Set([0, 1, 2, 3]), new Set());
    expect(off.x).toBeCloseTo(0);
    expect(off.y).toBeLessThan(0);
  });

  it('lifts everything up when all is picked', () => {
    const w = wholeOf('circle', 3, 100, 100);
    expect(pickOffset(w, new Set([0, 1, 2]), new Set()).y).toBeLessThan(0);
  });
});

describe('eating', () => {
  it('leaves a round slice along its center line and bites from the tip outward', () => {
    const w = wholeOf('circle', 6, 200, 200);
    const out = outward(w, 0, new Set());
    const rows = biteRows(w, 0, out);
    const along = rows.map((row) => row[0].x * out.x + row[0].y * out.y);
    expect(along).toEqual([...along].sort((a, b) => a - b));
    expect(along.at(-1)!).toBeGreaterThanOrEqual(w.r * 0.9);
  });

  it('bites a pan piece from its open edge', () => {
    const w = wholeOf('rectangle', 8, 400, 200);
    const out = outward(w, 0, new Set());
    expect(out).toEqual({ x: -1, y: 0 });
    const first = biteRows(w, 0, out)[0][0];
    expect(first.x).toBeLessThan(w.pieces[0].c.x);
  });
});

describe('sliceLayout', () => {
  it('turns compared wholes so their first slice points down', () => {
    const l = sliceLayout(sliceDemo('demo-slices-bigger'), 400, 500);
    expect(l.wholes.map((w) => w.rot)).toEqual([pointDown(2), pointDown(4)]);
    expect(l.meet.y).toBeGreaterThan(l.wholes[0].y);
  });

  it('gives each friend a spot along the bottom', () => {
    const l = sliceLayout(sliceDemo('demo-slices-each'), 400, 500);
    expect(l.kids).toHaveLength(4);
    for (const k of l.kids) expect(k.y).toBeGreaterThan(l.wholes[0].y);
  });
});

describe('demo items', () => {
  it.each(SLICE_DEMO_ITEMS.map((i) => [i.id, i] as const))('%s matches its scene', (_, item) => {
    expect(item.game?.kind).toBe('slices');
    expect(gameProblems(item, item.game!)).toEqual([]);
  });
});

describe('sliceUnit and sliceSummary', () => {
  const left = sliceDemo('demo-slices-take');

  it('speaks the way the question asks', () => {
    expect(sliceUnit(left, 3)).toBe('count');
    expect(sliceUnit(left, 0.5)).toBe('fraction');
    expect(sliceSummary(left, 'fraction')).toBe('5/6 take away 2/6 leaves 3/6.');
    expect(sliceSummary(left, 'count')).toBe('5 take away 2 leaves 3 slices.');
  });
});
