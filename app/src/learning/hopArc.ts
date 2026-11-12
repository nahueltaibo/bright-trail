/** The frog that hops the number line and the stepping stones. */
export const FROG = '🐸';
export const ARC = '#FF8A3D';
export const ARC_TEXT = '#C25E12';

export type Arc = { id: number; x0: number; x1: number; top: number; k: number };

/** A dashed arc from x0 to x1, drawn up to `k`, as sample points so it can grow while the frog hops. */
export function arcPath(a: Arc, lineY: number): string {
  const y0 = lineY - 10;
  const cy = 2 * a.top - y0;
  const n = Math.max(2, Math.ceil(24 * a.k));
  const pts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = (i / n) * a.k;
    const x = (1 - t) * (1 - t) * a.x0 + 2 * t * (1 - t) * ((a.x0 + a.x1) / 2) + t * t * a.x1;
    const y = (1 - t) * (1 - t) * y0 + 2 * t * (1 - t) * cy + t * t * y0;
    pts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return pts.join(' ');
}
