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
  organs: {
    brain: { x: 180, y: 34, side: 'right' },
    lungs: { x: 156, y: 118, side: 'left' },
    heart: { x: 188, y: 140, side: 'right' },
    liver: { x: 160, y: 176, side: 'left' },
    stomach: { x: 204, y: 180, side: 'right' },
    intestines: { x: 172, y: 232, side: 'left' },
  },
  machines: {
    lever: { x: 145, y: 62, side: 'left' },
    pulley: { x: 215, y: 34, side: 'right' },
    'inclined plane': { x: 156, y: 160, side: 'left' },
    'wheel and axle': { x: 215, y: 150, side: 'right' },
    wedge: { x: 145, y: 226, side: 'left' },
    screw: { x: 215, y: 246, side: 'right' },
  },
  planets: {
    sun: { x: 180, y: 10, side: 'right' },
    mercury: { x: 162, y: 50, side: 'left' },
    venus: { x: 201, y: 74, side: 'right' },
    earth: { x: 159, y: 100, side: 'left' },
    mars: { x: 199, y: 124, side: 'right' },
    jupiter: { x: 153, y: 158, side: 'left' },
    saturn: { x: 203, y: 202, side: 'right' },
    uranus: { x: 159, y: 240, side: 'left' },
    neptune: { x: 201, y: 272, side: 'right' },
  },
  map: {
    title: { x: 180, y: 37, side: 'right' },
    'compass rose': { x: 234, y: 76, side: 'right' },
    mountains: { x: 140, y: 84, side: 'left' },
    forest: { x: 222, y: 134, side: 'right' },
    lake: { x: 144, y: 150, side: 'left' },
    river: { x: 184, y: 206, side: 'left' },
    legend: { x: 133, y: 250, side: 'left' },
    scale: { x: 224, y: 261, side: 'right' },
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
