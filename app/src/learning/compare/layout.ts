import {
  compareNumbers,
  compareValue,
  compareView,
  compareWinner,
  type CompareScene,
} from '@bright-trail/shared';
import type { GameInput } from '../minigames/GameFrame';

export const STAGE_W = 360;
export const STAGE_H = 290;
const LINE_Y = 214;
const LINE_X0 = 34;
const LINE_X1 = 326;
/** The tallest tower, from its base up. */
const TOWER_SPACE = 186;
const TOWER_BASE = 236;
/** Flags closer than this stand at different heights so their cards don't cover each other. */
const FLAG_GAP = 58;
const FLAG_STEP = 36;

export type Pt = { x: number; y: number };
export type Tick = { x: number; label?: string };
export type Tower = { x: number; value: number; label: string };
export type Flag = { x: number; value: number; label: string; height: number; card: Pt };

export type CompareLayout =
  | { view: 'towers'; cube: number; base: number; towers: Tower[]; winner: number }
  | {
      view: 'line';
      y: number;
      x0: number;
      x1: number;
      ticks: Tick[];
      flags: Flag[];
      winner: number;
      /** Where the frog sits for a closer ask. */
      target?: { x: number; label: string; value: number };
    };

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const lcm = (a: number, b: number) => (a * b) / gcd(a, b);
const clean = (n: number) => Number(n.toFixed(9));

/** A 1, 2, or 5 times a power of ten that cuts `span` into at most 10 steps. */
export function niceStep(span: number): number {
  const power = Math.pow(10, Math.floor(Math.log10(span)) - 1);
  for (const k of [1, 2, 5, 10, 20, 50, 100]) if (span / (k * power) <= 10) return clean(k * power);
  return clean(100 * power);
}

/**
 * Where the line starts and ends and how it steps. Fractions step by their common unit when that
 * keeps to 12 steps, else by halves or wholes. Everything else steps by a nice decimal.
 */
export function lineOf(texts: readonly string[]): { min: number; max: number; step: number } {
  const nums = texts.map((t) => compareValue(t)!);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  if (texts.some((t) => t.includes('/'))) {
    const min = Math.floor(lo);
    const max = Math.max(Math.ceil(hi), min + 1);
    const dens = texts.map((t) => Number(/\/(\d+)$/.exec(t)?.[1] ?? 1));
    const unit = dens.reduce(lcm, 1);
    if ((max - min) * unit <= 12) return { min, max, step: 1 / unit };
    return { min, max, step: max - min <= 3 ? 0.5 : 1 };
  }
  // Equal values, as in "Is 6.3 equal to 6.30?", still need a line around them.
  const step = niceStep(hi - lo || Math.max(Math.abs(hi), 1));
  const min = clean(Math.floor(clean(lo / step)) * step);
  const max = clean(Math.ceil(clean(hi / step)) * step);
  return { min, max: max > min ? max : clean(min + step), step };
}

/** Labels for the ends of the line, and for each whole number on a line of fractions. */
function ticksOf(line: { min: number; max: number; step: number }, at: (v: number) => number) {
  const n = Math.round((line.max - line.min) / line.step);
  const fractions = line.step < 1 && Math.abs(1 / line.step - Math.round(1 / line.step)) < 1e-9;
  return Array.from({ length: n + 1 }, (_, i): Tick => {
    const v = clean(line.min + i * line.step);
    const end = i === 0 || i === n;
    const whole = Number.isInteger(v);
    return { x: at(v), ...((end || (fractions && whole)) && { label: String(v) }) };
  });
}

/** Gives each flag the lowest height no nearby flag to its left already has. */
function stagger(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x);
  const levels: number[] = [];
  const placed: { x: number; level: number }[] = [];
  for (const { x, i } of order) {
    const taken = new Set(placed.filter((p) => x - p.x < FLAG_GAP).map((p) => p.level));
    let level = 0;
    while (taken.has(level)) level++;
    levels[i] = level;
    placed.push({ x, level });
  }
  return levels;
}

/** Where everything stands on the 360 × 290 stage. */
export function layoutOf(s: CompareScene): CompareLayout {
  const nums = compareNumbers(s);
  const winner = compareWinner(s);
  if (compareView(s) === 'towers') {
    const most = Math.max(...nums);
    const cube = Math.min(28, Math.floor(TOWER_SPACE / most));
    const gap = STAGE_W / nums.length;
    return {
      view: 'towers',
      cube,
      base: TOWER_BASE,
      winner,
      towers: nums.map((value, i) => ({ x: gap * (i + 0.5), value, label: s.values[i] })),
    };
  }
  const texts = s.target ? [...s.values, s.target] : s.values;
  const line = lineOf(texts);
  const at = (v: number) =>
    LINE_X0 + ((v - line.min) / (line.max - line.min)) * (LINE_X1 - LINE_X0);
  const xs = nums.map(at);
  const levels = stagger(xs);
  const gap = STAGE_W / nums.length;
  const t = s.target === undefined ? undefined : compareValue(s.target)!;
  return {
    view: 'line',
    y: LINE_Y,
    x0: LINE_X0,
    x1: LINE_X1,
    ticks: ticksOf(line, at),
    winner,
    flags: nums.map((value, i) => ({
      x: xs[i],
      value,
      label: s.values[i],
      height: 64 + levels[i] * FLAG_STEP,
      card: { x: gap * (i + 0.5), y: 40 },
    })),
    ...(t !== undefined && { target: { x: at(t), label: s.target!, value: t } }),
  };
}

/** Choice labels as the scene writes its values, so 0.6 stays 0.6 rather than 3/5. */
export function sceneLabels(input: GameInput, s: CompareScene): GameInput {
  if (input.kind !== 'choices') return input;
  const nums = compareNumbers(s);
  return {
    ...input,
    choices: input.choices.map((c) => {
      const i = nums.findIndex((n) => typeof c.value === 'number' && Math.abs(n - c.value) < 1e-9);
      return i === -1 ? c : { ...c, label: s.values[i] };
    }),
  };
}
