import { GRID_UNITS, gridFills, type GridScene, type Item } from '@bright-trail/shared';
import type { GameInput } from '../minigames/GameFrame';

export const STAGE_W = 360;
export const STAGE_H = 290;
const MARGIN = 16;
/** Room above each group for its amount card, and below it for the running count. */
const CARD_H = 34;
const COUNT_H = 28;
const GAP = 10;

export type Cell = { x: number; y: number; size: number };
export type Whole = { x: number; y: number; w: number; h: number; cells: Cell[] };
export type Group = {
  /** The amount as the scene writes it. */
  label: string;
  /** How many cells this group's play-out fills, across its wholes in order. */
  fill: number;
  wholes: Whole[];
  card: { x: number; y: number };
  count: { x: number; y: number };
};
export type GridLayout = { unit: GridScene['unit']; groups: Group[] };

/**
 * Cells in fill order. A strip fills left to right. A hundred grid fills a column at a time,
 * top to bottom, so each column the child sees fill is one tenth.
 */
function cellsOf(unit: GridScene['unit'], x: number, y: number, cell: number): Cell[] {
  const size = GRID_UNITS[unit];
  return Array.from({ length: size }, (_, k) =>
    unit === 'tenths'
      ? { x: x + k * cell, y, size: cell }
      : { x: x + Math.floor(k / 10) * cell, y: y + (k % 10) * cell, size: cell },
  );
}

/** Where the strips or grids stand on the 360 × 290 stage. */
export function layoutOf(s: GridScene): GridLayout {
  const fills = gridFills(s);
  const size = GRID_UNITS[s.unit];
  const labels = s.other === undefined ? [s.amount] : [s.amount, s.other];
  const counts = fills.map((f) => Math.max(1, Math.ceil(f / size)));

  if (s.unit === 'tenths') {
    // Strips stack, and groups stack under each other.
    const cell = 30;
    const stripH = cell;
    const width = cell * 10;
    const x = (STAGE_W - width) / 2;
    const heights = counts.map((n) => CARD_H + n * stripH + (n - 1) * GAP + COUNT_H);
    let y = (STAGE_H - heights.reduce((a, b) => a + b, 0) - (counts.length - 1) * GAP) / 2;
    const groups = counts.map((n, g): Group => {
      const top = y + CARD_H;
      const wholes = Array.from({ length: n }, (_, i): Whole => {
        const wy = top + i * (stripH + GAP);
        return { x, y: wy, w: width, h: stripH, cells: cellsOf('tenths', x, wy, cell) };
      });
      const bottom = top + n * stripH + (n - 1) * GAP;
      const group = {
        label: labels[g],
        fill: fills[g],
        wholes,
        card: { x: STAGE_W / 2, y: y + CARD_H / 2 - 2 },
        count: { x: STAGE_W / 2, y: bottom + COUNT_H / 2 + 2 },
      };
      y += heights[g] + GAP;
      return group;
    });
    return { unit: s.unit, groups };
  }

  // Hundred grids stand side by side, and groups too, with a wider gap between groups.
  const total = counts.reduce((a, b) => a + b, 0);
  const groupGap = 28;
  const across =
    STAGE_W - 2 * MARGIN - (total - counts.length) * GAP - (counts.length - 1) * groupGap;
  const side =
    Math.floor(Math.min(across / total, STAGE_H - CARD_H - COUNT_H - 2 * MARGIN, 200) / 10) * 10;
  const cell = side / 10;
  const width = total * side + (total - counts.length) * GAP + (counts.length - 1) * groupGap;
  const top = (STAGE_H - side) / 2 + (CARD_H - COUNT_H) / 2;
  let x = (STAGE_W - width) / 2;
  const groups = counts.map((n, g): Group => {
    const left = x;
    const wholes = Array.from({ length: n }, (_, i): Whole => {
      const wx = left + i * (side + GAP);
      return { x: wx, y: top, w: side, h: side, cells: cellsOf('hundredths', wx, top, cell) };
    });
    const w = n * side + (n - 1) * GAP;
    x += w + groupGap;
    return {
      label: labels[g],
      fill: fills[g],
      wholes,
      card: { x: left + w / 2, y: top - CARD_H / 2 - 2 },
      count: { x: left + w / 2, y: top + side + COUNT_H / 2 + 2 },
    };
  });
  return { unit: s.unit, groups };
}

/** The cells a group shows filled once `shown` of its fill have played. */
export function filledCells(group: Group, shown: number): Cell[] {
  return group.wholes.flatMap((w) => w.cells).slice(0, Math.min(shown, group.fill));
}

export type Box = { x: number; y: number; w: number; h: number };

/**
 * The filled cells as a few boxes: per whole, one for the full columns and one for the rest.
 * Drawing a box per cell is too slow on web for a play-out of hundredths.
 */
export function filledBoxes(group: Group, shown: number): Box[] {
  let left = Math.min(shown, group.fill);
  const boxes: Box[] = [];
  for (const w of group.wholes) {
    const k = Math.min(left, w.cells.length);
    left -= k;
    if (k === 0) break;
    const cell = w.cells[0].size;
    if (w.cells.length === 10) {
      boxes.push({ x: w.x, y: w.y, w: k * cell, h: w.h });
      continue;
    }
    const cols = Math.floor(k / 10);
    if (cols > 0) boxes.push({ x: w.x, y: w.y, w: cols * cell, h: w.h });
    if (k % 10 > 0) boxes.push({ x: w.x + cols * cell, y: w.y, w: cell, h: (k % 10) * cell });
  }
  return boxes;
}

/** The lines between a whole's cells: columns for a strip, columns and rows for a grid. */
export function cellLines(w: Whole): { x1: number; y1: number; x2: number; y2: number }[] {
  const cell = w.cells[0].size;
  const cols = Array.from({ length: 9 }, (_, i) => {
    const x = w.x + (i + 1) * cell;
    return { x1: x, y1: w.y, x2: x, y2: w.y + w.h };
  });
  if (w.cells.length === 10) return cols;
  const rows = Array.from({ length: 9 }, (_, i) => {
    const y = w.y + (i + 1) * cell;
    return { x1: w.x, y1: y, x2: w.x + w.w, y2: y };
  });
  return [...cols, ...rows];
}

/**
 * The steps a group's play-out takes, as running fill counts. Tenths go one at a time. Hundredths
 * go a column at a time, then one at a time for the rest.
 */
export function fillSteps(unit: GridScene['unit'], fill: number): number[] {
  const steps: number[] = [];
  let n = 0;
  while (n < fill) {
    n += unit === 'hundredths' && fill - n >= 10 ? 10 : 1;
    steps.push(n);
  }
  return steps;
}

/** Number choices as decimals, since `formatAmount` would show 0.5 as 1/2. */
export function decimalLabels(input: GameInput, item: Item): GameInput {
  if (input.kind !== 'choices' || item.type !== 'tap') return input;
  return {
    ...input,
    choices: input.choices.map((c) => {
      const choice = item.choices.find((x) => x.id === c.id);
      return choice?.kind === 'number' ? { ...c, label: String(choice.value) } : c;
    }),
  };
}
