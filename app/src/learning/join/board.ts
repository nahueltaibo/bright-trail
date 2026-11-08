import { joinSpots, type JoinPlace, type JoinScene } from '@bright-trail/shared';

/** The stage is drawn at this size, then scaled to fit. */
export const STAGE_W = 360;
export const STAGE_H = 290;

export type Pt = { x: number; y: number };

export type Board = {
  place: JoinPlace;
  /** One ten-frame, or two stacked for numbers past 10. */
  frames: 1 | 2;
  /** Spots in fill order: left to right, top row first, then the second frame. */
  cells: Pt[];
  /** How big a thing is drawn. */
  size: number;
  /** Where walkers walk, below a bus. */
  ground: number;
  /** The spot's color. Bites are drawn in it, so an eaten thing shows the spot again. */
  spot: string;
  /** Where things start before a count story. */
  pile: Pt[];
  /** Where things go aside in a part story. */
  aside: Pt[];
  /** Where the summary bubble goes. */
  sum: Pt;
};

function grid(cx: number, cy: number, cell: number, gap: number): Pt[] {
  const out: Pt[] = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 5; c++) {
      out.push({ x: cx + (c - 2) * (cell + gap), y: cy + (r - 0.5) * (cell + gap) });
    }
  }
  return out;
}

/** The sag of a wire from pole to pole, so birds sit on it. */
export const WIRE_ROWS = [100, 178];
export const WIRE_SAG = 22;
export const WIRE_POLES = [16, 344];
export function wireY(row: number, x: number): number {
  const [a, b] = WIRE_POLES;
  const t = (x - a) / (b - a);
  return (1 - t) * (1 - t) * row + 2 * t * (1 - t) * (row + WIRE_SAG) + t * t * row;
}

/** A small, repeatable wobble, so a pile looks tossed but always the same. */
function jitter(i: number, amount: number): number {
  const v = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
  return (v - Math.floor(v) - 0.5) * 2 * amount;
}

/** Spots in one or two rows along the bottom band, centered. */
function band(n: number, rows: number[], spread: number): Pt[] {
  const perRow = Math.ceil(n / rows.length);
  const gap = Math.min(spread / Math.max(1, perRow - 1), 64);
  return Array.from({ length: n }, (_, i) => {
    const r = Math.floor(i / perRow);
    const inRow = Math.min(perRow, n - r * perRow);
    const c = i - r * perRow;
    return { x: 180 + (c - (inRow - 1) / 2) * gap, y: rows[r] };
  });
}

export function boardOf(s: JoinScene): Board {
  const two = joinSpots(s) > 10 || s.ask === 'make-ten';
  const n = s.start;
  const aside = s.ask === 'part' ? band(s.take!, [240], 220) : [];
  if (two) {
    const cells = [...grid(180, 72, 42, 5), ...grid(180, 180, 42, 5)];
    // Past 10 there's no room below, so the pile is a toss over the frames.
    const pile = cells.slice(0, n).map((c, i) => ({
      x: c.x + jitter(i, 16),
      y: c.y + jitter(i + 50, 14),
    }));
    pile.push(...pile.splice(0, Math.floor(n / 2)));
    return {
      place: s.place,
      frames: 2,
      cells,
      size: 32,
      ground: 260,
      spot: '#FBF6EA',
      pile,
      aside,
      sum: { x: 180, y: 266 },
    };
  }
  const pile = band(n, n > 5 ? [232, 266] : [250], 280).map((p, i) => ({
    x: p.x + jitter(i, 6),
    y: p.y + jitter(i + 9, 5),
  }));
  const base = { place: s.place, frames: 1 as const, pile, aside, sum: { x: 180, y: 264 } };
  switch (s.place) {
    case 'pond':
      return { ...base, cells: grid(180, 121, 54, 8), size: 38, ground: 250, spot: '#8BCB72' };
    case 'bus':
      return { ...base, cells: grid(170, 118, 48, 8), size: 36, ground: 258, spot: '#DDF1FF' };
    case 'wires': {
      const cells = WIRE_ROWS.flatMap((row) =>
        [0, 1, 2, 3, 4].map((c) => {
          const x = 180 + (c - 2) * 60;
          return { x, y: wireY(row, x) - 17 };
        }),
      );
      return { ...base, cells, size: 36, ground: 260, spot: '#E3F3FF' };
    }
    default: {
      const up = s.place === 'grass' || s.ask === 'part';
      return {
        ...base,
        cells: grid(180, up ? 104 : 118, 54, 6),
        size: 40,
        ground: 260,
        spot: '#FBF6EA',
      };
    }
  }
}
