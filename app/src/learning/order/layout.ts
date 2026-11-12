import type { OrderScene } from '@bright-trail/shared';
import { STAGE_H, STAGE_W, type Box } from '../cards/stage';

const PAD = 8;
/** Room between cards for an arrow. */
const ARROW = 20;
const ROW_Y = 112;

export type OrderLayout = {
  /** Each card's place in the row, the missing one's included. */
  slots: Box[];
  /** Where a picked card waits, below the stage, before it slides up into the gap. */
  start: Box;
  /** Arrows between neighbours, as [x0, x1] at the row's middle. */
  arrows: [number, number][];
  /** The loop back from the last card to the first, for cycles. */
  loop: string | null;
  rowY: number;
};

/** A row of cards across the middle of the stage, centred, with arrows between them. */
export function layoutOf(s: OrderScene): OrderLayout {
  const n = s.cards.length;
  const w = Math.min(86, (STAGE_W - PAD * 2 - ARROW * (n - 1)) / n);
  const h = Math.min(100, w * 1.25);
  const x0 = (STAGE_W - (w * n + ARROW * (n - 1))) / 2 + w / 2;
  const slots = s.cards.map((_, i) => ({ x: x0 + i * (w + ARROW), y: ROW_Y, w, h }));
  const arrows = slots
    .slice(1)
    .map((b, i): [number, number] => [slots[i].x + w / 2 + 3, b.x - w / 2 - 3]);
  const first = slots[0];
  const last = slots[n - 1];
  const bottom = ROW_Y + h / 2 + 6;
  const dip = bottom + 52;
  const loop = s.cycle
    ? `M ${last.x} ${bottom} C ${last.x} ${dip} ${first.x} ${dip} ${first.x} ${bottom}` +
      ` M ${first.x - 7} ${bottom + 9} L ${first.x} ${bottom} L ${first.x + 7} ${bottom + 9}`
    : null;
  return { slots, start: { x: STAGE_W / 2, y: STAGE_H + h, w, h }, arrows, loop, rowY: ROW_Y };
}
