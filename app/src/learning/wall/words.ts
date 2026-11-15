import { wallFraction, type WallScene } from '@bright-trail/shared';

const PIECE_NAMES: Record<number, string> = {
  1: 'wholes',
  2: 'halves',
  3: 'thirds',
  4: 'fourths',
  5: 'fifths',
  6: 'sixths',
  7: 'sevenths',
  8: 'eighths',
  9: 'ninths',
  10: 'tenths',
  11: 'elevenths',
  12: 'twelfths',
};

/** "fourths" for pieces of 1/4, "wholes" for whole pieces. */
export const piecesName = (parts: number) => PIECE_NAMES[parts] ?? `pieces of 1/${parts}`;

const fill = (s: WallScene) =>
  s.ask === 'pass'
    ? `Fill the ${piecesName(s.parts!)} just past the dashed line.`
    : `Fill the ${piecesName(s.parts!)} up to the dashed line.`;

/**
 * Keypad words like "Type the missing numerator." as the wall's build. The generator's words
 * can't change without new LLM calls, and they still fit the keypad screen, so the app swaps
 * them only while the wall plays the item.
 */
export function wallNarration(text: string, s: WallScene): string {
  if (s.ask !== 'fill' && s.ask !== 'pass') return text;
  return text.replace(/\bType (the|your|a)\b[^.?!]*[.?!]?/, fill(s));
}

/** The line under a build, saying how to fill the strip. */
export function wallHint(s: WallScene): string {
  return `Tap or slide along the ${piecesName(s.parts!)}. ${
    s.ask === 'pass' ? 'Make them just pass the dashed line.' : 'Fill them to the dashed line.'
  }`;
}

/** What the edges show about two fractions as written, like "3/8" and "1/2". */
export function wallNote(lower: string, top: string): string {
  const a = wallFraction(lower)!.value;
  const b = wallFraction(top)!.value;
  if (Math.abs(a - b) < 1e-9) return `${lower} and ${top} end at the same edge.`;
  return a > b ? `${lower} reaches further than ${top}.` : `${top} reaches further than ${lower}.`;
}

/**
 * What the play-out says. A hit's feedback says what the edges show. A miss's feedback gives
 * the item's why, and the note under the wall says what the edges show, so each fits its room.
 */
export function wallWords(
  s: WallScene,
  shown: { mine: string; lower: string },
  correct: boolean,
  why: string,
): { feedback: string; note: string | null } {
  const note = wallNote(shown.lower, s.than);
  if (correct) return { feedback: note, note: null };
  if (shown.mine !== shown.lower) {
    return { feedback: why, note: `You made ${shown.mine}. The wall shows ${shown.lower}.` };
  }
  return { feedback: why, note };
}
