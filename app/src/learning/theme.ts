import { useWindowDimensions } from 'react-native';

export const colors = {
  background: '#FFFBF0',
  ink: '#5A4A1F',
  softInk: '#8A7A4F',
  surface: '#FFF4D6',
  pressed: '#FFE7A3',
  accent: '#FFB347',
  line: '#C9B98A',
  good: '#DFF5E1',
  goodInk: '#2E7D4F',
  // Misses get a calm blue, never red.
  gentle: '#E8EEFF',
  gentleInk: '#3F51A3',
  dot: '#FF8A65',
};

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
