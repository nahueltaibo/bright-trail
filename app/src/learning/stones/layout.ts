import { stoneNumbers, stoneStep, stepText, type StonesScene } from '@bright-trail/shared';

export const STAGE_W = 360;
export const STAGE_H = 290;
/** The top of the water, where stones sit. */
export const WATER_Y = 206;
/** Where the frog waits before its first hop. */
export const BANK_X = 28;
const ROW_X0 = 92;
const ROW_X1 = 316;
const MAX_GAP = 84;

export type Stone = { x: number; label: string; value: number; missing: boolean };

export type StonesLayout = {
  stones: Stone[];
  /** Stone width. Rows of many stones get narrower ones. */
  size: number;
  /** Each hop's step, signed: "+2" or "−1". */
  hop: string;
};

/** Where each stone sits on the 360 × 290 stage, centred in the space right of the bank. */
export function layoutOf(s: StonesScene): StonesLayout {
  const nums = stoneNumbers(s);
  const n = nums.length;
  const gap = Math.min(MAX_GAP, (ROW_X1 - ROW_X0) / (n - 1));
  const start = (ROW_X0 + ROW_X1 - gap * (n - 1)) / 2;
  return {
    size: Math.min(62, gap - 6),
    hop: `${stoneStep(s) > 0 ? '+' : '−'}${stepText(s)}`,
    stones: nums.map((value, i) => ({
      x: start + i * gap,
      label: s.stones[i],
      value,
      missing: i === s.missing,
    })),
  };
}
