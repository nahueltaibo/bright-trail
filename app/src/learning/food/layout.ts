import { sliceValues, type SliceScene } from '@bright-trail/shared';
import type { Pt } from './geometry';

/** Room above the food for the summary bubble. */
export const TOP_ROOM = 44;

export type WholeSpot = { x: number; y: number; w: number; h: number; parts: number; rot: number };
export type SliceLayout = { wholes: WholeSpot[]; kids: Pt[]; meet: Pt };

/** Turns a round whole so its first slice points straight down, toward where slices meet. */
export const pointDown = (parts: number) => 0.5 - 1 / (2 * parts);

/** Where the wholes, the kids who get slices, and the meeting point for compared slices go. */
export function sliceLayout(s: SliceScene, W: number, H: number): SliceLayout {
  const round = s.shape === 'circle';
  const usable = H - TOP_ROOM;
  // Round food needs room around it: its plate, and space for a slice to slide off the plate.
  const fit = (boxW: number, boxH: number) =>
    round
      ? { w: Math.min(boxW, boxH) / 1.55, h: Math.min(boxW, boxH) / 1.55 }
      : s.shape === 'bar'
        ? { w: boxW * 0.86, h: Math.min(boxH * 0.5, boxW * 0.2) }
        : { w: Math.min(boxW * 0.84, boxH * 1.4), h: Math.min(boxH * 0.62, boxW * 0.6) };

  if (s.ask === 'each') {
    const friends = s.friends ?? s.parts;
    const top = usable * 0.58;
    const size = fit(W, top);
    const kids = Array.from({ length: friends }, (_, i) => ({
      x: (W / friends) * (i + 0.5),
      y: H - 62,
    }));
    return {
      wholes: [{ x: W / 2, y: TOP_ROOM + top / 2, ...size, parts: s.parts, rot: 0 }],
      kids,
      meet: { x: W / 2, y: H / 2 },
    };
  }

  if (s.ask === 'bigger') {
    const top = usable * 0.55;
    const size = fit(W / 2, top);
    const spot = (x: number, parts: number): WholeSpot => ({
      x,
      y: TOP_ROOM + top / 2,
      ...size,
      parts,
      rot: round ? pointDown(parts) : 0,
    });
    return {
      wholes: [spot(W / 4, s.parts), spot((3 * W) / 4, s.other!)],
      kids: [],
      meet: { x: W / 2, y: TOP_ROOM + top + (usable - top) * 0.25 },
    };
  }

  const n = s.wholes ?? 1;
  // Wholes past one leave room under them for a "1 whole" bubble.
  const area = usable - (n > 1 ? 30 : 0);
  const stacked = s.shape === 'bar' && n > 1;
  const size = stacked ? fit(W, area / n) : fit(W / n, area);
  const wholes = Array.from({ length: n }, (_, i) => ({
    x: stacked ? W / 2 : (W / n) * (i + 0.5),
    y: stacked ? TOP_ROOM + (area / n) * (i + 0.5) : TOP_ROOM + area / 2,
    ...size,
    parts: s.parts,
    rot: 0,
  }));
  return { wholes, kids: [], meet: { x: W / 2, y: H / 2 } };
}

/**
 * Whether the item asks for a count of slices ("how many fourths?") or a fraction ("what
 * part?"). Bubbles and feedback then speak the same way the question does.
 */
export function sliceUnit(s: SliceScene, answer: number): 'count' | 'fraction' {
  if (s.ask === 'parts') return 'count';
  if (s.ask === 'bigger') return 'fraction';
  const [count] = sliceValues(s);
  return Math.abs(count - answer) < 1e-9 ? 'count' : 'fraction';
}

/** Global slice numbers across wholes, as whole and slice. */
export const slotOf = (s: SliceScene, g: number) => ({
  w: Math.floor(g / s.parts),
  i: g % s.parts,
});
