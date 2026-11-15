import Svg, { Path } from 'react-native-svg';
import { color } from './tokens';

type Part = string | { fill: string };

/** The design's line icons on a 24px grid. Strings are strokes, `{ fill }` parts are filled. */
const PATHS = {
  speaker: [
    'M4 9.5h3.5L12 5.5v13l-4.5-4H4z',
    'M15.5 9a4 4 0 0 1 0 6',
    'M18 6.5a7.5 7.5 0 0 1 0 11',
  ],
  flag: ['M6 21V4', 'M6 4.5h11l-2.5 4 2.5 4H6'],
  home: ['M3.5 11 12 4l8.5 7', 'M6 9.5V20h12V9.5', 'M10 20v-5h4v5'],
  lock: ['M6 11h12v9H6z', 'M8.5 11V8a3.5 3.5 0 0 1 7 0v3'],
  back: ['M14.5 5.5 8 12l6.5 6.5'],
  next: ['M9.5 5.5 16 12l-6.5 6.5'],
  check: ['M5 12.5 9.5 17 19 7.5'],
  backspace: ['M9 5.5h11v13H9L3.5 12z', 'M12.5 9.5l5 5', 'M17.5 9.5l-5 5'],
  pause: ['M9 6v12', 'M15 6v12'],
  play: [
    { fill: 'M8 5.2v13.6c0 .8.9 1.3 1.6.8l10-6.8a1 1 0 0 0 0-1.6l-10-6.8C8.9 3.9 8 4.4 8 5.2z' },
  ],
  plus: ['M12 5v14', 'M5 12h14'],
  minus: ['M5 12h14'],
  share: ['M12 3.5v11', 'M7.5 8 12 3.5 16.5 8', 'M5.5 13v6.5h13V13'],
  chevron: ['M9.5 6 15.5 12l-6 6'],
  sprout: [
    'M12 20.5V12',
    'M12 13C12 9 9.3 7 5 7c0 4 2.7 6 7 6z',
    'M12 11c0-3.2 2.4-5.2 6.5-5.2 0 3.2-2.4 5.2-6.5 5.2z',
  ],
  refresh: ['M19.5 12a7.5 7.5 0 1 1-2.2-5.3', 'M19.5 4.5v4h-4'],
  question: [
    'M9.2 9.2a2.9 2.9 0 1 1 4 2.7c-.8.4-1.2 1-1.2 1.8v.6',
    { fill: 'M12 16.6a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z' },
  ],
  half: ['M12 4a8 8 0 1 0 0 16 8 8 0 1 0 0-16z', { fill: 'M12 4a8 8 0 0 1 0 16z' }],
  gap: ['M12 4a8 8 0 1 1-7.6 5.5'],
  star: [{ fill: 'M12 2.6l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4l-5.8 3 1.1-6.4-4.7-4.6 6.5-.9z' }],
  moon: ['M19.5 14.5A8 8 0 1 1 9.5 4.5a6.3 6.3 0 0 0 10 10z'],
  book: [
    'M12 6.5C10.5 5 8.5 4.5 4 4.5v14c4.5 0 6.5.5 8 2',
    'M12 6.5c1.5-1.5 3.5-2 8-2v14c-4.5 0-6.5.5-8 2',
    'M12 6.5v14',
  ],
  close: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'],
  alert: [
    'M12 3.5 21 19.5H3z',
    'M12 10v4',
    { fill: 'M12 16.2a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 0 0 0-2.2z' },
  ],
  tree: ['M4 5h6v4H4z', 'M14 5h6v4h-6z', 'M9 15h6v4H9z', 'M7 9v3h10V9', 'M12 12v3'],
  list: [
    'M9 6.5h11',
    'M9 12h11',
    'M9 17.5h11',
    {
      fill: 'M4.5 5.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM4.5 10.7a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6zM4.5 16.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z',
    },
  ],
  bookmark: ['M7 4h10v16l-5-3.5L7 20z'],
  hand: [
    'M9 11V5a1.5 1.5 0 0 1 3 0v5m0-1a1.5 1.5 0 0 1 3 0v2m0-1a1.5 1.5 0 0 1 3 0v4a6 6 0 0 1-6 6h-1a6 6 0 0 1-4.6-2.2L4 15.5a1.5 1.5 0 0 1 2.3-1.9L9 16',
  ],
} satisfies Record<string, Part[]>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  size = 24,
  tint = color.kidInk,
  stroke = 2.4,
}: {
  name: IconName;
  size?: number;
  tint?: string;
  stroke?: number;
}) {
  const parts: readonly Part[] = PATHS[name];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {parts.map((d, i) =>
        typeof d === 'string' ? (
          <Path
            key={i}
            d={d}
            fill="none"
            stroke={tint}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <Path key={i} d={d.fill} fill={tint} />
        ),
      )}
    </Svg>
  );
}

/** The only reward: a gold star with an ink outline. `empty` draws the outline alone. */
export function Star({ size = 24, empty = false }: { size?: number; empty?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d={(PATHS.star[0] as { fill: string }).fill}
        fill={empty ? 'none' : color.star}
        stroke={color.starInk}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
    </Svg>
  );
}
