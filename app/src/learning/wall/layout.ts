import {
  wallAnswer,
  wallFraction,
  wallRows,
  wallWholes,
  type WallFraction,
  type WallScene,
} from '@bright-trail/shared';
import type { GameInput } from '../minigames/GameFrame';

/** Whether the child builds the lower strip, or picks a choice and then sees both strips. */
export const isBuild = (s: WallScene) => s.ask === 'fill' || s.ask === 'pass';

/** A count of pieces as the item would write it: "3/4", "23/6", or "2" for wholes. */
export function fractionText(count: number, parts: number): string {
  return parts === 1 ? String(count) : `${count}/${parts}`;
}

/**
 * Wholes the wall shows. A `match` ask counts every choice, so the strip of any pick fits. A
 * build counts its answer, so the guide and the right fill both fit.
 */
export function wallWholesFor(s: WallScene, choiceLabels: readonly string[]): number {
  const values = wallRows(s).map((r) => r.value);
  if (isBuild(s)) values.push((wallAnswer(s) as number) / s.parts!);
  if (s.ask === 'match') {
    for (const l of choiceLabels) {
      const f = wallFraction(l);
      if (f) values.push(f.value);
    }
  }
  return wallWholes(values);
}

/** The build input a fill or pass ask answers with, in place of the keypad. */
export function buildInput(s: WallScene, wholes: number): GameInput {
  const parts = s.parts!;
  return { kind: 'build', max: parts * wholes, label: (n) => fractionText(n, parts) };
}

/**
 * How many pieces a touch at `x` along a strip `width` wide fills. A tap fills up to the piece
 * it lands on, and a tap on the last filled piece takes it away. A drag snaps to the nearest
 * edge, so the finger can rest on a line between thin pieces.
 */
export function countAt(
  x: number,
  width: number,
  pieces: number,
  how: 'tap' | 'drag',
  current: number,
): number {
  const at = (Math.max(0, Math.min(width, x)) / width) * pieces;
  if (how === 'drag') return Math.round(at);
  const n = Math.max(1, Math.ceil(at));
  return n === current ? n - 1 : n;
}

/** Where a fraction's edge falls on a wall `width` wide. */
export const edgeX = (f: Pick<WallFraction, 'count' | 'parts'>, wholes: number, width: number) =>
  (f.count / f.parts / wholes) * width;

/** Below this width, a piece shows no 1/n label. */
export const LABEL_MIN_PIECE = 34;
