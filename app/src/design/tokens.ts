import { Platform, type TextStyle } from 'react-native';

/** Light-theme colours from `.docs/design/tokens.json`. Kid and parent zones never mix. */
export const color = {
  kidBg: '#fffbf0',
  kidSurface: '#fff4d6',
  kidSurfaceRaised: '#ffffff',
  kidPressed: '#ffe7a3',
  kidInk: '#5a4a1f',
  kidInkSoft: '#6b5a2c',
  kidLine: '#eadbb0',
  kidLineStrong: '#9a844a',
  trail: '#ffb347',
  onTrail: '#3d2e06',
  trailDeep: '#9a5300',
  sun: '#ffe08a',
  meadow: '#eaf4dc',
  star: '#ffc21a',
  starInk: '#8a5a00',
  counter: '#d35f26',
  hitBg: '#dff5e1',
  hitInk: '#2a7349',
  missBg: '#e8eeff',
  missInk: '#3f51a3',
  avPeach: '#ffe1cc',
  avMint: '#d6f2e4',
  avSky: '#d9ecff',
  avLilac: '#ece1ff',
  focus: '#1a5dd6',
  pBg: '#f7f8fa',
  pSurface: '#ffffff',
  pSurfaceSunken: '#eef1f5',
  pInk: '#1d2433',
  pInkMuted: '#545d70',
  pLine: '#e1e5ec',
  pLineStrong: '#7e889b',
  pPrimary: '#2f5bd3',
  onPPrimary: '#ffffff',
  pPrimarySoft: '#e8eefc',
  pDanger: '#b3261e',
  onPDanger: '#ffffff',
  pDangerSoft: '#fbeae8',
  pOk: '#1e7a4c',
} as const;

/** Skill state ink and ground, for parent badges. */
export const stateColor = {
  unknown: { ink: '#5a6170', bg: '#eef0f3' },
  assumed: { ink: '#1f6294', bg: '#e2f0fa' },
  gap: { ink: '#9c3f00', bg: '#fdeadb' },
  learning: { ink: '#6e5400', bg: '#fff2c2' },
  mastered: { ink: '#006a4b', bg: '#d9f2e8' },
  review: { ink: '#933a6d', bg: '#f6e2ee' },
} as const;

export const radius = { sm: 8, md: 14, lg: 22, xl: 32, pill: 999 } as const;

export const TAP_KID = 64;
export const TAP_PARENT = 48;

export const shadow = {
  ledge: { boxShadow: '0 4px 0 #e6d3a3' },
  ledgeTrail: { boxShadow: '0 4px 0 #d98a1f' },
  lift: { boxShadow: '0 8px 24px rgba(90,74,31,0.14)' },
  card: { boxShadow: '0 1px 2px rgba(29,36,51,0.08)' },
  none: { boxShadow: 'none' },
} as const;

/** Pressed kid controls drop onto their ledge. */
export const pressDown = { transform: [{ translateY: 3 }], boxShadow: 'none' } as const;

type Weight = 400 | 500 | 600 | 700 | 800;

const DISPLAY: Record<Weight, string> = {
  400: 'Baloo2_400Regular',
  500: 'Baloo2_500Medium',
  600: 'Baloo2_600SemiBold',
  700: 'Baloo2_700Bold',
  800: 'Baloo2_800ExtraBold',
};

/**
 * Each weight is its own family on Android, so styles pick a family instead of `fontWeight`.
 * Tests have no fonts loaded, which is fine: the family name is only a style.
 */
export const font = {
  display: (weight: Weight = 700): TextStyle => ({ fontFamily: DISPLAY[weight] }),
  body: (weight: 400 | 700 = 400): TextStyle => ({
    fontFamily: weight === 700 ? 'AtkinsonHyperlegible_700Bold' : 'AtkinsonHyperlegible_400Regular',
  }),
  mono: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Consolas, monospace' }),
};

/**
 * The dyslexia font's face for each design face. Baloo 2 drops a weight step, since Lexend is
 * heavier: `dys-prompt` is 500 where `kid-prompt` is 700.
 */
const LEXEND: Readonly<Record<string, string>> = {
  Baloo2_400Regular: 'Lexend_400Regular',
  Baloo2_500Medium: 'Lexend_400Regular',
  Baloo2_600SemiBold: 'Lexend_500Medium',
  Baloo2_700Bold: 'Lexend_500Medium',
  Baloo2_800ExtraBold: 'Lexend_700Bold',
  AtkinsonHyperlegible_400Regular: 'Lexend_400Regular',
  AtkinsonHyperlegible_700Bold: 'Lexend_600SemiBold',
};

/**
 * What to lay over a `font.display` or `font.body` style when the dyslexia font is on: Lexend,
 * 0.02em letter spacing, and taller lines. Null for any other face, so emoji and inherited
 * nested text stay as they are. React Native has no word spacing.
 */
export function dyslexicFont(style: Readonly<TextStyle> | null | undefined): TextStyle | null {
  const fontFamily = style?.fontFamily && LEXEND[style.fontFamily];
  if (!fontFamily) return null;
  return {
    fontFamily,
    letterSpacing: (style.fontSize ?? 14) * 0.02,
    ...(style.lineHeight !== undefined && { lineHeight: style.lineHeight * 1.12 }),
  };
}
