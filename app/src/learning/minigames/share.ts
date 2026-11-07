export type Kid = { name: string; emoji: string };

/** What the objects sit in. Each kind has its own look. */
export type ContainerKind = 'plate' | 'bowl' | 'basket' | 'bucket' | 'box';

export type Thing = {
  emoji: string;
  one: string;
  many: string;
  /** Food can be cut into pieces. Balls and toys can't, so their choices must be whole. */
  cuttable?: boolean;
};

export type ShareProblem = {
  id: string;
  sharer: Kid;
  thing: Thing;
  container: ContainerKind;
  friends: Kid[];
  total: number;
  /**
   * Amounts per friend, written "3", "2 1/2", or "3/4". A fraction's denominator must divide the
   * number of friends, since leftovers are cut into one piece per friend.
   */
  choices: string[];
};

/** An amount per friend, in pieces: 1 piece is 1/friends of an object. */
export type Amount = { label: string; pieces: number };

const AMOUNT = /^(?:(\d+)(?:\s+(\d+)\/(\d+))?|(\d+)\/(\d+))$/;

/** Parses "2", "2 1/2", or "3/4" into pieces of 1/`friends` of an object. */
export function parseAmount(label: string, friends: number, cuttable = true): Amount {
  const m = AMOUNT.exec(label.trim());
  if (!m) throw new Error(`Bad amount "${label}"`);
  const whole = Number(m[1] ?? 0);
  const num = Number(m[2] ?? m[4] ?? 0);
  const den = Number(m[3] ?? m[5] ?? 1);
  if (num > 0 && !cuttable) throw new Error(`"${label}" needs cutting, but this can't be cut`);
  if (friends % den !== 0) {
    throw new Error(`"${label}" can't be cut for ${friends} friends`);
  }
  return { label: label.trim(), pieces: whole * friends + num * (friends / den) };
}

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/** Pieces of 1/`den` as a reduced mixed number: 5 pieces of 1/2 is "2 1/2". */
export function formatPieces(pieces: number, den: number): string {
  const whole = Math.floor(pieces / den);
  const rest = pieces % den;
  if (rest === 0) return String(whole);
  const g = gcd(rest, den);
  const fraction = `${rest / g}/${den / g}`;
  return whole === 0 ? fraction : `${whole} ${fraction}`;
}

/** A whole object moves to a friend's slot. */
export type WholeStep = { kind: 'whole'; thing: number; friend: number; slot: number };
/** An object on the sharer's plate splits into one piece per friend. */
export type CutStep = { kind: 'cut'; thing: number };
/** One piece of a cut object moves into a friend's part slot, at position `at`. */
export type PieceStep = {
  kind: 'piece';
  thing: number;
  piece: number;
  friend: number;
  slot: number;
  at: number;
};
export type DealStep = WholeStep | CutStep | PieceStep;

export type DealResult = 'fair' | 'leftover' | 'short';

export type DealPlan = {
  steps: DealStep[];
  result: DealResult;
  /** What stays on the sharer's plate, in pieces. */
  leftover: number;
};

/**
 * Deals `amount` to every friend the way a child shares by hand: whole objects one round at a
 * time, then cuts what's left into one piece per friend and deals the pieces the same way.
 */
export function planDeal(total: number, friends: number, amount: number): DealPlan {
  const wholeEach = Math.floor(amount / friends);
  const piecesEach = amount % friends;
  const steps: DealStep[] = [];
  let next = 0;
  let short = false;

  for (let slot = 0; slot < wholeEach; slot++) {
    for (let friend = 0; friend < friends; friend++) {
      if (next >= total) short = true;
      else steps.push({ kind: 'whole', thing: next++, friend, slot });
    }
  }

  // Pieces of the most recent cut that no friend has yet.
  let cut = -1;
  let unused = 0;
  for (let at = 0; at < piecesEach && !short; at++) {
    for (let friend = 0; friend < friends; friend++) {
      if (unused === 0) {
        if (next >= total) {
          short = true;
          break;
        }
        cut = next++;
        unused = friends;
        steps.push({ kind: 'cut', thing: cut });
      }
      steps.push({
        kind: 'piece',
        thing: cut,
        piece: friends - unused,
        friend,
        slot: wholeEach,
        at,
      });
      unused -= 1;
    }
  }

  const leftover = (total - next) * friends + unused;
  const result = short ? 'short' : leftover > 0 ? 'leftover' : 'fair';
  return { steps, result, leftover };
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
  /** Width of one friend's column. Names may use all of it. */
  columnWidth: number;
  friends: { avatar: Point; plate: Rect; slots: Point[] }[];
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
 * Places the sharer and their plate in the top 40% and one column per friend below. Friend
 * plates fit the largest choice, so the layout stays put whatever the child taps.
 */
export function layoutStage(
  width: number,
  height: number,
  total: number,
  friends: number,
  slotsEach: number,
): StageLayout {
  const topH = height * 0.4;
  const bottomH = height - topH;
  const colW = width / friends;

  const srcCols = Math.min(total, Math.ceil(Math.sqrt(total * 2)));
  const srcRows = Math.ceil(total / srcCols);
  const fCols = Math.ceil(Math.sqrt(slotsEach));
  const fRows = Math.ceil(slotsEach / fCols);

  const sharerSize = Math.min(topH * 0.5, width * 0.18, 88);
  const avatarSize = Math.min(colW * 0.4, bottomH * 0.25, 80);
  const plateRoom = bottomH - avatarSize - 2 * LABEL_HEIGHT - 3 * PAD - HANDLE_HEIGHT;
  const srcRoom = width - sharerSize - 4 * PAD;

  const size = Math.floor(
    Math.min(
      srcRoom / (srcCols + 0.5),
      (topH - 2 * PAD - HANDLE_HEIGHT) / (srcRows + 0.5),
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
  const sourcePlate = {
    x: left + sharerSize + PAD * 2,
    y: (topH - srcH + HANDLE_HEIGHT) / 2,
    w: srcW,
    h: srcH,
  };

  const plateW = fCols * size + 2 * inset;
  const plateH = fRows * size + 2 * inset;
  const friendLayouts = Array.from({ length: friends }, (_, g) => {
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
    friends: friendLayouts,
  };
}
