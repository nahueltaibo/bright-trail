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

export function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}
