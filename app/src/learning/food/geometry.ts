import type { FractionShape } from '@bright-trail/shared';

export type Pt = { x: number; y: number };
/** One slice, relative to its whole's center. */
export type Piece = { d: string; c: Pt; w: number; h: number };
export type Whole = {
  round: boolean;
  /** Radius for round wholes. */
  r: number;
  /** The drawn food, without its plate or tray. */
  W: number;
  H: number;
  /** A slice's typical size: how far picked slices slide and how big bites are. */
  unit: number;
  parts: number;
  pieces: Piece[];
};

/** Turn 0 is twelve o'clock, going clockwise, the way kids cut a pizza. */
export function turnPoint(r: number, turn: number): Pt {
  const a = turn * 2 * Math.PI - Math.PI / 2;
  return { x: r * Math.cos(a), y: r * Math.sin(a) };
}

export function wedgePath(r: number, from: number, to: number): string {
  if (to - from >= 0.999) return `M ${-r} 0 A ${r} ${r} 0 1 1 ${r} 0 A ${r} ${r} 0 1 1 ${-r} 0 Z`;
  const a = turnPoint(r, from);
  const b = turnPoint(r, to);
  return `M 0 0 L ${a.x} ${a.y} A ${r} ${r} 0 ${to - from > 0.5 ? 1 : 0} 1 ${b.x} ${b.y} Z`;
}

/** Rows and columns for a rectangle cut into `parts`, as square as the count allows. */
export function gridOf(parts: number): { rows: number; cols: number } {
  let rows = Math.floor(Math.sqrt(parts));
  while (parts % rows !== 0) rows--;
  return { rows, cols: parts / rows };
}

/**
 * A whole cut into `parts`, fitted to a `width` × `height` box. `rot` turns a round whole so a
 * slice can point a chosen way.
 */
export function wholeOf(
  shape: FractionShape,
  parts: number,
  width: number,
  height: number,
  rot = 0,
): Whole {
  if (shape === 'circle') {
    const r = Math.min(width, height) / 2;
    const th = (2 * Math.PI) / parts;
    // The centroid of a wedge sits 4r·sin(θ/2) / 3θ from the tip.
    const dist = (4 * r * Math.sin(th / 2)) / (3 * th);
    const pieces = Array.from({ length: parts }, (_, i) => {
      const from = rot + i / parts;
      const to = rot + (i + 1) / parts;
      return { d: wedgePath(r, from, to), c: turnPoint(dist, (from + to) / 2), w: r, h: r };
    });
    return { round: true, r, W: 2 * r, H: 2 * r, unit: r, parts, pieces };
  }
  const { rows, cols } = shape === 'bar' ? { rows: 1, cols: parts } : gridOf(parts);
  let cw = Math.min(width / cols, height / rows);
  let ch = cw;
  if (shape === 'bar') {
    cw = width / cols;
    ch = Math.min(height, width * 0.2);
  }
  const W = cw * cols;
  const H = ch * rows;
  const pieces = Array.from({ length: parts }, (_, i) => {
    const x = -W / 2 + (i % cols) * cw;
    const y = -H / 2 + Math.floor(i / cols) * ch;
    return {
      d: `M ${x} ${y} h ${cw} v ${ch} h ${-cw} Z`,
      c: { x: x + cw / 2, y: y + ch / 2 },
      w: cw,
      h: ch,
    };
  });
  return { round: false, r: 0, W, H, unit: Math.min(cw, ch), parts, pieces };
}

const avg = (pts: Pt[]): Pt => ({
  x: pts.reduce((a, p) => a + p.x, 0) / pts.length,
  y: pts.reduce((a, p) => a + p.y, 0) / pts.length,
});

/** How far picked slices slide out, as a share of the whole's unit. */
export const PULL = { round: 0.34, grid: 0.42 };

/**
 * Where picked slices go: together, straight away from the slices that stay, so the picked part
 * keeps its shape. One round slice slides along its own center line.
 */
export function pickOffset(w: Whole, picked: ReadonlySet<number>, gone: ReadonlySet<number>): Pt {
  const P = w.pieces.filter((_, i) => picked.has(i));
  const R = w.pieces.filter((_, i) => !picked.has(i) && !gone.has(i));
  if (P.length === 0) return { x: 0, y: 0 };
  let v: Pt = { x: 0, y: -1 };
  if (w.round && P.length === 1 && R.length > 0) v = P[0].c;
  else if (R.length > 0) {
    const a = avg(P.map((p) => p.c));
    const b = avg(R.map((p) => p.c));
    v = { x: a.x - b.x, y: a.y - b.y };
  }
  const L = Math.hypot(v.x, v.y);
  const d = w.unit * (w.round ? PULL.round : PULL.grid);
  return L < 0.5 ? { x: 0, y: -d } : { x: (v.x / L) * d, y: (v.y / L) * d };
}

/** The way a slice leaves its whole: its center line when round, away from the rest otherwise. */
export function outward(w: Whole, i: number, gone: ReadonlySet<number>): Pt {
  const c = w.pieces[i].c;
  if (w.round) {
    const L = Math.hypot(c.x, c.y) || 1;
    return { x: c.x / L, y: c.y / L };
  }
  const rest = w.pieces.filter((_, j) => j !== i && !gone.has(j));
  if (rest.length === 0) return { x: 0, y: -1 };
  const a = avg(rest.map((p) => p.c));
  const vx = c.x - a.x;
  const vy = c.y - a.y;
  return Math.abs(vx) > Math.abs(vy)
    ? { x: Math.sign(vx), y: 0 }
    : { x: 0, y: Math.sign(vy) || -1 };
}

export type Bite = { x: number; y: number; r: number; u: Pt };

/** Bite spots in rows, from the tip of a wedge (or the open edge of a piece) to the far end. */
export function biteRows(w: Whole, i: number, out: Pt): Bite[][] {
  const p = w.pieces[i];
  const rows: Bite[][] = [];
  const row = (k: number, at: (j: number) => Pt, r: number, u: Pt) =>
    Array.from({ length: k }, (_, j) => ({ ...at(j), r, u }));
  if (w.round) {
    const R = w.r;
    const th = (2 * Math.PI) / w.parts;
    const u = out;
    const n = { x: -u.y, y: u.x };
    const br = R * Math.min(0.32, Math.max(0.17, (th / Math.PI) * 0.34));
    for (let d = br * 0.45; d < R + br * 0.5; d += br * 1.15) {
      const wide = th < Math.PI - 0.01 ? d * Math.tan(th / 2) : Infinity;
      const hw = Math.min(wide, Math.sqrt(Math.max(0, R * R - d * d))) + br * 0.3;
      const k = Math.max(1, Math.ceil((2 * hw) / (br * 1.6)));
      rows.push(
        row(
          k,
          (j) => {
            const t = k === 1 ? 0 : -hw + ((j + 0.5) * 2 * hw) / k;
            return { x: u.x * d + n.x * t, y: u.y * d + n.y * t };
          },
          br,
          u,
        ),
      );
    }
    return rows;
  }
  const along = out.x ? p.w : p.h;
  const across = out.x ? p.h : p.w;
  const br = Math.min(p.w, p.h) * 0.3;
  const u = { x: -out.x, y: -out.y };
  const n = { x: -u.y, y: u.x };
  const start = { x: p.c.x + (out.x * along) / 2, y: p.c.y + (out.y * along) / 2 };
  for (let d = br * 0.2; d < along + br * 0.5; d += br * 1.1) {
    const hw = across / 2 + br * 0.2;
    const k = Math.max(1, Math.ceil((2 * hw) / (br * 1.6)));
    rows.push(
      row(
        k,
        (j) => {
          const t = -hw + ((j + 0.5) * 2 * hw) / k;
          return { x: start.x + u.x * d + n.x * t, y: start.y + u.y * d + n.y * t };
        },
        br,
        u,
      ),
    );
  }
  return rows;
}

/** A seeded random stream, so a food looks the same every time it's drawn. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** A slightly lumpy circle, like melted cheese or a hand-rolled cookie. */
export function wobble(r: number, amp: number, seed: number): string {
  let d = '';
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * 2 * Math.PI;
    const rr = r * (1 + amp * Math.sin(7 * a + seed) + amp * 0.7 * Math.sin(12 * a + seed * 2));
    d += `${i ? 'L' : 'M'} ${rr * Math.cos(a)} ${rr * Math.sin(a)} `;
  }
  return `${d}Z`;
}
