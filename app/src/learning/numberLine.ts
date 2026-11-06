type Line = { min: number; max: number; step: number };

function decimalsOf(n: number): number {
  const text = String(n);
  const exp = /e-(\d+)$/.exec(text);
  if (exp) return Number(exp[1]);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}

export function stepCount({ min, max, step }: Line): number {
  return Math.round((max - min) / step);
}

/** Value at a step index, rounded so 0.1 steps give 0.3 rather than 0.30000000000000004. */
export function valueAt(index: number, line: Line): number {
  const decimals = Math.max(decimalsOf(line.step), decimalsOf(line.min));
  return Number((line.min + index * line.step).toFixed(decimals));
}

/** Nearest step index to a fraction (0 at min, 1 at max) along the line. */
export function indexAtFraction(fraction: number, line: Line): number {
  const n = stepCount(line);
  return Math.min(n, Math.max(0, Math.round(fraction * n)));
}

/** Nearest step index to a value. */
export function indexOfValue(value: number, line: Line): number {
  return indexAtFraction((value - line.min) / (line.max - line.min), line);
}

/** Label every k-th tick so at most 11 labels share the line. */
export function labelEvery(n: number): number {
  if (n <= 10) return 1;
  for (const k of [2, 5, 10, 20, 25, 50, 100, 200, 250, 500]) {
    if (n % k === 0 && n / k <= 10) return k;
  }
  return Math.ceil(n / 10);
}
