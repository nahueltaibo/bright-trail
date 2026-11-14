import { useWindowDimensions } from 'react-native';
import { color } from '../design/tokens';

/** Kid-zone names the item screens and minigames use, mapped onto the design tokens. */
export const colors = {
  background: color.kidBg,
  ink: color.kidInk,
  softInk: color.kidInkSoft,
  surface: color.kidSurface,
  raised: color.kidSurfaceRaised,
  pressed: color.kidPressed,
  accent: color.trail,
  line: color.kidLineStrong,
  good: color.hitBg,
  goodInk: color.hitInk,
  // Misses get a calm blue, never red.
  gentle: color.missBg,
  gentleInk: color.missInk,
  dot: color.counter,
};

/** Width share of the answer pane in landscape. The question side needs less. */
export const ANSWER_PANE_SHARE = 0.55;

/** Smallest tap target, in points. */
export const MIN_TAP = 64;

export const CORRECT_TEXT = 'Yes! Great job!';
export const MISS_TEXT = 'Good try!';

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const tablet = Math.min(width, height) >= 600;
  return { width, height, landscape: width > height, tablet, scale: tablet ? 1.4 : 1 };
}

/** Shrinks long strings so "10, 20, 30, 40, 50" still fits on a phone. */
export function fontSizeFor(text: string, base: number): number {
  if (text.length <= 6) return base;
  if (text.length <= 12) return base * 0.75;
  if (text.length <= 24) return base * 0.55;
  return base * 0.45;
}

// Average advance of a lowercase or digit glyph, as a share of font size. Measured in the browser:
// Baloo 2 bold runs 0.43–0.56, Lexend bold (the dyslexia font) 0.50–0.62.
const GLYPH_WIDTH = 0.62;
/** Line height, as a share of font size, that `fitFontSize` assumes. Set it on fitted text. */
export const LINE_HEIGHT = 1.2;

/** Lines `text` wraps to at `perLine` characters, or `Infinity` when a word can't fit a line. */
function wrapLines(text: string, perLine: number): number {
  let lines = 0;
  let used = 0;
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (word.length > perLine) return Infinity;
    if (lines > 0 && used + 1 + word.length <= perLine) used += 1 + word.length;
    else {
      lines += 1;
      used = word.length;
    }
  }
  return lines;
}

/**
 * The biggest font size, from `base` down to `min`, at which `text` fits a box without breaking a
 * word. Returns `min` when nothing fits, so callers can pick a roomier layout instead.
 */
export function fitFontSize(
  text: string,
  box: { width: number; height: number },
  { base, min, maxLines = 3 }: { base: number; min: number; maxLines?: number },
): number {
  for (let size = Math.floor(base); size > min; size--) {
    const lines = wrapLines(text, Math.floor(box.width / (size * GLYPH_WIDTH)));
    // The dyslexia font's lines run 12% taller, so every child's text gets that room.
    if (lines <= maxLines && lines * size * LINE_HEIGHT * 1.12 <= box.height) return size;
  }
  return min;
}

export function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}
