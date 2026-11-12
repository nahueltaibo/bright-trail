import { arrayParts, type ArrayScene } from '@bright-trail/shared';

export const STAGE_W = 360;
export const STAGE_H = 290;
/** The grid's box. The strip to its left holds row labels, the strip above the fact. */
const AREA = { x0: 60, y0: 54, x1: 344, y1: 280 };
const MAX_CELL = 34;
/** How far a split's two parts slide apart. */
export const SPLIT_GAP = 16;

export type Pt = { x: number; y: number };
export type Cell = {
  row: number;
  column: number;
  /** Where it sits in the whole array. */
  at: Pt;
  /** Where it sits once a split pulls the parts apart. */
  apart: Pt;
  /** 0 for the first part of a split, 1 for the second. Always 0 without a split. */
  part: 0 | 1;
};

export type ArrayLayout = {
  cell: number;
  center: Pt;
  /** In fill order: row by row, or one per row at a time for a `columns` ask. */
  cells: Cell[];
  /** The y of each row's middle, for its label. */
  rowY: number[];
  /** Where the row labels stand. */
  labelX: number;
  /** Where each part's label stands once a split pulls them apart. */
  partLabels?: [Pt, Pt];
};

/** Where every thing stands on the 360 × 290 stage. */
export function layoutOf(s: ArrayScene): ArrayLayout {
  const split = s.ask === 'split' ? s.split! : undefined;
  const gapX = split?.by === 'columns' ? SPLIT_GAP : 0;
  const gapY = split?.by === 'rows' ? SPLIT_GAP : 0;
  const w = AREA.x1 - AREA.x0;
  const h = AREA.y1 - AREA.y0;
  const fit = (rows: number, columns: number) => Math.min((w - gapX) / columns, (h - gapY) / rows);
  // A turn ends as columns rows of rows, so the cell must fit both ways round.
  const cell = Math.floor(
    Math.min(
      MAX_CELL,
      fit(s.rows, s.columns),
      s.ask === 'turn' ? fit(s.columns, s.rows) : Infinity,
    ),
  );
  const center = { x: (AREA.x0 + AREA.x1) / 2, y: (AREA.y0 + AREA.y1) / 2 };
  const left = center.x - (s.columns * cell) / 2;
  const top = center.y - (s.rows * cell) / 2;

  const place = (row: number, column: number): Cell => {
    const at = { x: left + (column + 0.5) * cell, y: top + (row + 0.5) * cell };
    const part = split && (split.by === 'rows' ? row : column) >= split.at ? 1 : 0;
    const shift = (part ? 1 : -1) / 2;
    return {
      row,
      column,
      at,
      apart: split ? { x: at.x + shift * gapX, y: at.y + shift * gapY } : at,
      part,
    };
  };
  const cells: Cell[] = [];
  if (s.ask === 'columns') {
    for (let c = 0; c < s.columns; c++) for (let r = 0; r < s.rows; r++) cells.push(place(r, c));
  } else {
    for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.columns; c++) cells.push(place(r, c));
  }

  let partLabels: [Pt, Pt] | undefined;
  if (split) {
    const [a, b] = arrayParts(s);
    if (split.by === 'columns') {
      const y = top - 14;
      partLabels = [
        { x: left + (a.columns * cell) / 2 - gapX / 2, y },
        { x: left + (a.columns + b.columns / 2) * cell + gapX / 2, y },
      ];
    } else {
      const x = left - 30;
      partLabels = [
        { x, y: top + (a.rows * cell) / 2 - gapY / 2 },
        { x, y: top + (a.rows + b.rows / 2) * cell + gapY / 2 },
      ];
    }
  }

  return {
    cell,
    center,
    cells,
    rowY: Array.from({ length: s.rows }, (_, r) => top + (r + 0.5) * cell),
    labelX: left - 24,
    ...(partLabels && { partLabels }),
  };
}

/**
 * Where a cell stands `k` of the way through a quarter turn clockwise about the array's middle.
 * At 1 the array is `columns` rows of `rows`, still upright, since only positions turn.
 */
export function turned(p: Pt, center: Pt, k: number): Pt {
  const a = (k * Math.PI) / 2;
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * Math.cos(a) - dy * Math.sin(a),
    y: center.y + dx * Math.sin(a) + dy * Math.cos(a),
  };
}
