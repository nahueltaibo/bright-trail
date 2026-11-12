import type { LabelScene, Picture, PICTURES } from '@bright-trail/shared';
import { STAGE_H, STAGE_W, type Box } from '../cards/stage';

/** A part's spot on its picture, and the side its tag goes on. */
export type Spot = { x: number; y: number; side: 'left' | 'right' };

/** Where each part sits on its drawing in `pictures.tsx`. */
export const SPOTS: { [P in Picture]: Record<(typeof PICTURES)[P][number], Spot> } = {
  plant: {
    flower: { x: 180, y: 58, side: 'right' },
    leaf: { x: 154, y: 146, side: 'left' },
    stem: { x: 180, y: 182, side: 'right' },
    roots: { x: 174, y: 250, side: 'left' },
    seed: { x: 232, y: 232, side: 'right' },
  },
  insect: {
    antennae: { x: 84, y: 104, side: 'left' },
    head: { x: 110, y: 150, side: 'left' },
    thorax: { x: 150, y: 150, side: 'left' },
    legs: { x: 138, y: 199, side: 'left' },
    wings: { x: 196, y: 114, side: 'right' },
    abdomen: { x: 218, y: 154, side: 'right' },
  },
  body: {
    head: { x: 180, y: 50, side: 'right' },
    arm: { x: 136, y: 118, side: 'left' },
    hand: { x: 118, y: 164, side: 'left' },
    chest: { x: 180, y: 112, side: 'right' },
    leg: { x: 194, y: 214, side: 'right' },
    foot: { x: 160, y: 262, side: 'left' },
  },
};

const TAG_W = 88;
const TAG_H = 32;
const GAP = 8;
const TOP = TAG_H / 2 + 6;
const BOTTOM = STAGE_H - TAG_H / 2 - 6;

export type Tag = { box: Box; spot: Spot };

/** Each tag beside the picture, at its spot's height, pushed apart so none overlap. */
export function layoutOf(s: LabelScene): Tag[] {
  const spots: Record<string, Spot> = SPOTS[s.picture];
  const tags: Tag[] = s.tags.map((t) => {
    const spot = spots[t.part];
    const x = spot.side === 'left' ? TAG_W / 2 + 4 : STAGE_W - TAG_W / 2 - 4;
    return { spot, box: { x, y: spot.y, w: TAG_W, h: TAG_H } };
  });
  for (const side of ['left', 'right'] as const) {
    const column = tags.filter((t) => t.spot.side === side).sort((a, b) => a.spot.y - b.spot.y);
    const step = TAG_H + GAP;
    column.forEach((t, i) => {
      const above = i > 0 ? column[i - 1].box.y + step : TOP;
      t.box.y = Math.max(t.box.y, above);
    });
    for (let i = column.length - 1; i >= 0; i--) {
      const below = i < column.length - 1 ? column[i + 1].box.y - step : BOTTOM;
      column[i].box.y = Math.min(column[i].box.y, below);
    }
  }
  return tags;
}

/** Where a picked tag waits, below the stage, before it slides up to the asked spot. */
export const START: Box = { x: STAGE_W / 2, y: STAGE_H + TAG_H, w: TAG_W, h: TAG_H };
