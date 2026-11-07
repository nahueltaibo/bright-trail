export type ShareProblem = {
  id: string;
  sharer: { name: string; emoji: string };
  thing: { emoji: string; one: string; many: string };
  friends: { name: string; emoji: string }[];
  total: number;
  choices: number[];
};

/** One object moving from the sharer's plate to a friend's slot. */
export type DealStep = { thing: number; friend: number; slot: number };

export type DealResult = 'fair' | 'leftover' | 'short';

export type DealPlan = {
  steps: DealStep[];
  result: DealResult;
  /** Objects still on the sharer's plate. */
  leftover: number;
  /** Empty slots once the objects run out. */
  missing: number;
};

/** Deals `each` to every friend, one round at a time, the way a child shares by hand. */
export function planDeal(total: number, friends: number, each: number): DealPlan {
  const steps: DealStep[] = [];
  for (let slot = 0; slot < each; slot++) {
    for (let friend = 0; friend < friends && steps.length < total; friend++) {
      steps.push({ thing: steps.length, friend, slot });
    }
  }
  const needed = friends * each;
  const leftover = Math.max(0, total - needed);
  const missing = Math.max(0, needed - total);
  const result = leftover > 0 ? 'leftover' : missing > 0 ? 'short' : 'fair';
  return { steps, result, leftover, missing };
}

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type StageLayout = {
  /** Side of one object, in points. */
  size: number;
  sharer: { at: Point; size: number };
  sourcePlate: Rect;
  /** Top-left of each object while it sits on the sharer's plate. */
  source: Point[];
  avatarSize: number;
  friends: { avatar: Point; plate: Rect; slots: Point[] }[];
};

const PAD = 8;
const LABEL = 24;

function grid(count: number, cols: number, plate: Rect, size: number, inset: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    x: plate.x + inset + (i % cols) * size,
    y: plate.y + inset + Math.floor(i / cols) * size,
  }));
}

/**
 * Places the sharer and their plate in the top 40% and one column per friend below. Friend
 * plates fit the largest choice, so the layout stays put whatever the child taps.
 */
export function layoutStage(
  width: number,
  height: number,
  total: number,
  friends: number,
  maxEach: number,
): StageLayout {
  const topH = height * 0.4;
  const bottomH = height - topH;
  const colW = width / friends;

  const srcCols = Math.min(total, Math.ceil(Math.sqrt(total * 2)));
  const srcRows = Math.ceil(total / srcCols);
  const fCols = Math.ceil(Math.sqrt(maxEach));
  const fRows = Math.ceil(maxEach / fCols);

  const sharerSize = Math.min(topH * 0.5, width * 0.18, 88);
  const avatarSize = Math.min(colW * 0.4, bottomH * 0.25, 80);
  const plateRoom = bottomH - avatarSize - 2 * LABEL - 3 * PAD;
  const srcRoom = width - sharerSize - 4 * PAD;

  const size = Math.floor(
    Math.min(
      srcRoom / (srcCols + 0.5),
      (topH - 2 * PAD) / (srcRows + 0.5),
      (colW - 3 * PAD) / (fCols + 0.5),
      plateRoom / (fRows + 0.5),
      72,
    ),
  );
  const inset = size * 0.25;

  const srcW = srcCols * size + 2 * inset;
  const srcH = srcRows * size + 2 * inset;
  const groupW = sharerSize + PAD * 2 + srcW;
  const left = (width - groupW) / 2;
  const sourcePlate = { x: left + sharerSize + PAD * 2, y: (topH - srcH) / 2, w: srcW, h: srcH };

  const plateW = fCols * size + 2 * inset;
  const plateH = fRows * size + 2 * inset;
  const friendLayouts = Array.from({ length: friends }, (_, g) => {
    const cx = g * colW + colW / 2;
    const avatar = { x: cx - avatarSize / 2, y: topH + PAD };
    const plate = {
      x: cx - plateW / 2,
      y: avatar.y + avatarSize + LABEL + PAD,
      w: plateW,
      h: plateH,
    };
    return { avatar, plate, slots: grid(maxEach, fCols, plate, size, inset) };
  });

  return {
    size,
    sharer: { at: { x: left, y: topH / 2 - sharerSize / 2 - LABEL / 2 }, size: sharerSize },
    sourcePlate,
    source: grid(total, srcCols, sourcePlate, size, inset),
    avatarSize,
    friends: friendLayouts,
  };
}

export const LABEL_HEIGHT = LABEL;
