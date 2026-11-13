import { sameText, type SortScene } from '@bright-trail/shared';
import { STAGE_H, STAGE_W, type Box } from '../cards/stage';

const PAD = 8;
const GAP = 8;
const BINS_TOP = 96;
const HEADER = 44;
const CHIP_H = 28;
const CHIP_GAP = 4;

/** The card the child sorts, waiting above the bins. */
export const START: Box = { x: STAGE_W / 2, y: 46, w: 120, h: 76 };

export type SortLayout = {
  bins: Box[];
  /** Where each card already sorted sits, in scene order. */
  sorted: Box[];
  /** Where the asked card lands in each bin, after the cards already there. */
  landing: Box[];
};

/** Bins side by side across the bottom, each stacking its cards under its name. */
export function layoutOf(s: SortScene): SortLayout {
  const n = s.bins.length;
  const w = (STAGE_W - PAD * 2 - GAP * (n - 1)) / n;
  const h = STAGE_H - BINS_TOP - PAD;
  const bins = s.bins.map((_, i) => ({
    x: PAD + w / 2 + i * (w + GAP),
    y: BINS_TOP + h / 2,
    w,
    h,
  }));
  // Every bin keeps room for one more card, wherever the child drops it.
  const most = Math.max(...s.bins.map((_, i) => s.sorted.filter((c) => c.bin === i).length)) + 1;
  const room = h - HEADER - PAD;
  const chipH = Math.min(CHIP_H, room / most - CHIP_GAP);
  const chip = (bin: number, slot: number): Box => ({
    x: bins[bin].x,
    y: BINS_TOP + HEADER + slot * (chipH + CHIP_GAP) + chipH / 2,
    w: w - 10,
    h: chipH,
  });
  const count = s.bins.map(() => 0);
  const sorted = s.sorted.map((c) => chip(c.bin, count[c.bin]++));
  return { bins, sorted, landing: s.bins.map((_, i) => chip(i, count[i])) };
}

/** The bin a picked word names. The right bin when it names none. */
export function binOf(s: SortScene, picked: string): number {
  const i = s.bins.findIndex((b) => sameText(b.text, picked));
  return i < 0 ? s.bin : i;
}
