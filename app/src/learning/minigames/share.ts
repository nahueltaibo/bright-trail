import {
  THINGS,
  type Amount,
  type ContainerKind,
  type FractionFood,
  type Scene,
  type SceneAsk,
  type ThingId,
} from '@bright-trail/shared';
import { castFrom, kidFor, type Kid } from './cast';

export type Thing = {
  emoji: string;
  one: string;
  many: string;
  cuttable: boolean;
  /** Drawn as food art instead of its emoji. Round food cuts into wedges, bars into strips. */
  food?: FractionFood;
};

/** Things the slices art can draw. A bar is granola unless the story calls it chocolate. */
export function foodOf(thing: ThingId, one: string): FractionFood | undefined {
  if (thing === 'pie' || thing === 'pizza' || thing === 'cookie') return thing;
  if (thing === 'bar') return /chocolate/i.test(one) ? 'chocolate' : 'granola';
  return undefined;
}

/** Who gets a share. Kids have a name and picture, stores only a picture, containers neither. */
export type Receiver = { name?: string; emoji?: string };

/** One sharer and their receivers. A compare problem has two. */
export type Side = { sharer: Kid; receivers: Receiver[] };

/** A scene with its cast filled in, ready to play. */
export type ShareProblem = {
  id: string;
  ask: SceneAsk;
  thing: Thing;
  container: ContainerKind;
  total: number;
  side: Side;
  /** compare: the same total shared by another group. */
  other?: Side;
  each?: number;
  split?: number[];
  want?: 'more' | 'less';
};

/** Fills in the cast: named kids from the story, the rest from the pool, fixed by `seed`. */
export function problemFromScene(scene: Scene, seed: string): ShareProblem {
  const named = [scene.sharer, scene.otherSharer, ...(scene.named ?? [])]
    .filter((p) => p !== undefined)
    .map((p) => p.name);
  const next = castFrom(seed, named);
  const side = (groups: number, sharer = scene.sharer, names = scene.named ?? []): Side => ({
    sharer: sharer ? kidFor(sharer) : next(),
    receivers: Array.from({ length: groups }, (_, i): Receiver => {
      if (scene.receivers === 'containers') return {};
      if (scene.receivers === 'stores') return { emoji: '🏪' };
      return names[i] ? kidFor(names[i]) : next();
    }),
  });
  const thing = THINGS[scene.thing];
  return {
    id: seed,
    ask: scene.ask,
    thing: {
      emoji: thing.emoji,
      cuttable: thing.cuttable,
      one: scene.one,
      many: scene.many,
      ...(foodOf(scene.thing, scene.one) && { food: foodOf(scene.thing, scene.one) }),
    },
    container: scene.container,
    total: scene.total,
    side: side(scene.groups),
    ...(scene.otherGroups !== undefined && {
      other: side(scene.otherGroups, scene.otherSharer, []),
    }),
    ...(scene.each !== undefined && { each: scene.each }),
    ...(scene.split !== undefined && { split: scene.split }),
    ...(scene.want !== undefined && { want: scene.want }),
  };
}

/** Most slots a container can show. More would make the things too small on a phone. */
export const MAX_SLOTS = 10;

/**
 * Slots each receiver's container needs, so the layout stays put whatever the child answers.
 * `answers` are the choices, or for a typed answer the right one.
 */
export function slotsFor(p: ShareProblem, answers: readonly number[], typed: boolean): number {
  const groups = p.side.receivers.length;
  switch (p.ask) {
    case 'each': {
      const most = Math.max(...answers.map((a) => Math.ceil(a)));
      // A typed answer can be a little high: leave room to show the empty spots.
      return Math.min(typed ? most + 2 : most, MAX_SLOTS);
    }
    case 'left':
      return Math.max(1, Math.floor(p.total / groups));
    case 'groups':
    case 'total':
      return p.each!;
    case 'fair':
      return Math.max(1, ...p.split!);
    case 'compare':
      return Math.ceil(p.total / Math.min(groups, p.other!.receivers.length));
  }
}

/** A whole thing moves to a receiver's slot. */
export type WholeStep = { kind: 'whole'; thing: number; receiver: number; slot: number };
/** A thing on the sharer's plate splits into one piece per receiver. */
export type CutStep = { kind: 'cut'; thing: number };
/** One piece of a cut thing moves into a receiver's part slot, at position `at`. */
export type PieceStep = {
  kind: 'piece';
  thing: number;
  piece: number;
  receiver: number;
  slot: number;
  at: number;
};
export type DealStep = WholeStep | CutStep | PieceStep;

export type DealResult = 'fair' | 'leftover' | 'short';

export type DealPlan = {
  steps: DealStep[];
  result: DealResult;
  /** What stays on the sharer's plate: whole things, and pieces of 1/den from a cut thing. */
  left: { wholes: number; pieces: number; den: number };
};

/**
 * Deals `amount` to every receiver the way a child shares by hand: whole things one round at a
 * time, then cuts what's left into `den` pieces and deals the pieces the same way.
 */
export function planDeal(
  total: number,
  receivers: number,
  amount: Pick<Amount, 'whole' | 'parts' | 'den'>,
): DealPlan {
  const steps: DealStep[] = [];
  let next = 0;
  let short = false;

  for (let slot = 0; slot < amount.whole; slot++) {
    for (let receiver = 0; receiver < receivers; receiver++) {
      if (next >= total) short = true;
      else steps.push({ kind: 'whole', thing: next++, receiver, slot });
    }
  }

  // Pieces of the most recent cut that no receiver has yet.
  let cut = -1;
  let unused = 0;
  for (let at = 0; at < amount.parts && !short; at++) {
    for (let receiver = 0; receiver < receivers; receiver++) {
      if (unused === 0) {
        if (next >= total) {
          short = true;
          break;
        }
        cut = next++;
        unused = amount.den;
        steps.push({ kind: 'cut', thing: cut });
      }
      steps.push({
        kind: 'piece',
        thing: cut,
        piece: amount.den - unused,
        receiver,
        slot: amount.whole,
        at,
      });
      unused -= 1;
    }
  }

  const left = { wholes: total - next, pieces: unused, den: amount.den };
  const result = short ? 'short' : left.wholes + left.pieces > 0 ? 'leftover' : 'fair';
  return { steps, result, left };
}

/** Fills one group at a time with `each`, until the things run out. */
export function planFill(total: number, each: number): WholeStep[] {
  return Array.from({ length: total }, (_, t) => ({
    kind: 'whole',
    thing: t,
    receiver: Math.floor(t / each),
    slot: t % each,
  }));
}

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };

export type StageLayout = {
  /** Side of one thing, in points. */
  size: number;
  sharer: { at: Point; size: number };
  sourcePlate: Rect;
  /** Top-left of each thing while it sits on the sharer's plate. */
  source: Point[];
  avatarSize: number;
  /** Width of one receiver's column. Names may use all of it. */
  columnWidth: number;
  receivers: { avatar: Point; plate: Rect; slots: Point[] }[];
};

const PAD = 8;
export const LABEL_HEIGHT = 24;
/** Room above a container for a basket or bucket handle. */
export const HANDLE_HEIGHT = 14;

function grid(count: number, cols: number, plate: Rect, size: number, inset: number): Point[] {
  return Array.from({ length: count }, (_, i) => ({
    x: plate.x + inset + (i % cols) * size,
    y: plate.y + inset + Math.floor(i / cols) * size,
  }));
}

/**
 * Places the sharer and their plate in the top 40% and one column per receiver below. Without a
 * source, as in "is it fair?", the receivers get the whole height.
 */
export function layoutStage(
  width: number,
  height: number,
  total: number,
  receivers: number,
  slotsEach: number,
  withSource = true,
): StageLayout {
  const topH = withSource ? height * 0.4 : 0;
  const bottomH = height - topH;
  const colW = width / receivers;

  const srcCols = Math.min(total, Math.ceil(Math.sqrt(total * 2)));
  const srcRows = Math.ceil(total / srcCols);
  const fCols = Math.ceil(Math.sqrt(slotsEach));
  const fRows = Math.ceil(slotsEach / fCols);

  const sharerSize = Math.min(topH * 0.5, width * 0.18, 88);
  const avatarSize = Math.min(colW * 0.4, bottomH * 0.25, 80);
  const plateRoom = bottomH - avatarSize - 2 * LABEL_HEIGHT - 3 * PAD - HANDLE_HEIGHT;
  const srcRoom = width - sharerSize - 4 * PAD;

  const size = Math.max(
    8,
    Math.floor(
      Math.min(
        withSource ? srcRoom / (srcCols + 0.5) : Infinity,
        withSource ? (topH - 2 * PAD - HANDLE_HEIGHT) / (srcRows + 0.5) : Infinity,
        (colW - 3 * PAD) / (fCols + 0.5),
        plateRoom / (fRows + 0.5),
        72,
      ),
    ),
  );
  const inset = size * 0.25;

  const srcW = srcCols * size + 2 * inset;
  const srcH = srcRows * size + 2 * inset;
  const groupW = sharerSize + PAD * 2 + srcW;
  const left = (width - groupW) / 2;
  const sourcePlate = {
    x: left + sharerSize + PAD * 2,
    y: (topH - srcH + HANDLE_HEIGHT) / 2,
    w: srcW,
    h: srcH,
  };

  const plateW = fCols * size + 2 * inset;
  const plateH = fRows * size + 2 * inset;
  const receiverLayouts = Array.from({ length: receivers }, (_, g) => {
    const cx = g * colW + colW / 2;
    const avatar = { x: cx - avatarSize / 2, y: topH + PAD };
    const plate = {
      x: cx - plateW / 2,
      y: avatar.y + avatarSize + LABEL_HEIGHT + PAD + HANDLE_HEIGHT,
      w: plateW,
      h: plateH,
    };
    return { avatar, plate, slots: grid(slotsEach, fCols, plate, size, inset) };
  });

  return {
    size,
    sharer: { at: { x: left, y: topH / 2 - sharerSize / 2 - LABEL_HEIGHT / 2 }, size: sharerSize },
    sourcePlate,
    source: grid(total, srcCols, sourcePlate, size, inset),
    avatarSize,
    columnWidth: colW,
    receivers: receiverLayouts,
  };
}
