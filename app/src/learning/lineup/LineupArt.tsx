import type { LineThing } from '@bright-trail/shared';
import type { ReactNode } from 'react';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';

const INK = '#3b2f14';
const SHIRTS = [
  '#4f8fd8',
  '#e0703a',
  '#59a65b',
  '#b066c9',
  '#e3b52c',
  '#d9577a',
  '#3fa7a0',
  '#8a6bd6',
];
const SKINS = [
  '#f2c9a0',
  '#d9a074',
  '#a86f47',
  '#f5d6b8',
  '#7a4b2c',
  '#e8b48a',
  '#c58a5c',
  '#f0c39a',
];
const HAIR = [
  '#5a3a1e',
  '#2b211a',
  '#c98b2e',
  '#7a3b1c',
  '#1f1a17',
  '#a0522d',
  '#3d2b1f',
  '#e0b04a',
];

/** Four legs, a body and a head, facing left toward the front of the line. */
function Animal({ fill, dark, children }: { fill: string; dark: string; children?: ReactNode }) {
  return (
    <>
      <Rect x={13} y={29} width={3.4} height={8.5} rx={1.6} fill={dark} />
      <Rect x={27} y={29} width={3.4} height={8.5} rx={1.6} fill={dark} />
      <Ellipse cx={22} cy={25} rx={12} ry={7.5} fill={fill} />
      <Rect x={16} y={29} width={3.4} height={8.5} rx={1.6} fill={fill} />
      <Rect x={30} y={28} width={3.4} height={9.5} rx={1.6} fill={fill} />
      <Circle cx={11} cy={17} r={7} fill={fill} />
      {children}
      <Circle cx={8} cy={16} r={1.4} fill={INK} />
    </>
  );
}

function Art({ thing, index }: { thing: LineThing; index: number }) {
  switch (thing) {
    case 'cat':
      return (
        <Animal fill="#f0a24b" dark="#c97c2a">
          <Path
            d="M33 23 C38 20 38 12 35 9"
            stroke="#f0a24b"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <Path d="M5 13 L6.5 6 L10.5 11 Z" fill="#f0a24b" />
          <Path d="M11 10.5 L14.5 5 L16.5 12 Z" fill="#f0a24b" />
          <Circle cx={4.6} cy={19} r={1.1} fill="#d9577a" />
        </Animal>
      );
    case 'dog':
      return (
        <Animal fill="#c98d55" dark="#9c6a3a">
          <Path
            d="M33 22 C37 19 37 15 36 13"
            stroke="#c98d55"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
          />
          <Ellipse cx={4.5} cy={19.5} rx={3.4} ry={2.6} fill="#e5b98a" />
          <Circle cx={2.4} cy={18.6} r={1.2} fill={INK} />
          <Ellipse cx={14} cy={17} rx={2.6} ry={5.2} fill="#7a4f2a" />
        </Animal>
      );
    case 'bear':
      return (
        <Animal fill="#8a5a3b" dark="#6b4329">
          <Circle cx={7} cy={10.5} r={2.8} fill="#8a5a3b" />
          <Circle cx={14.5} cy={10.5} r={2.8} fill="#8a5a3b" />
          <Ellipse cx={5} cy={19.5} rx={3.3} ry={2.6} fill="#c69a74" />
          <Circle cx={3} cy={18.8} r={1.1} fill={INK} />
        </Animal>
      );
    case 'bunny':
      return (
        <Animal fill="#e9e4dc" dark="#c9c2b6">
          <Ellipse cx={9} cy={5.5} rx={2} ry={6} fill="#e9e4dc" />
          <Ellipse cx={13.5} cy={6} rx={2} ry={6} fill="#e9e4dc" />
          <Ellipse cx={13.5} cy={6.5} rx={0.9} ry={4} fill="#f2b8c6" />
          <Circle cx={34.5} cy={23} r={3} fill="#ffffff" />
          <Circle cx={4.6} cy={19} r={1.1} fill="#d9577a" />
        </Animal>
      );
    case 'frog':
      return (
        <>
          <Ellipse cx={28} cy={33} rx={7} ry={4.5} fill="#3f9c4a" />
          <Ellipse cx={20} cy={29} rx={15} ry={8.5} fill="#5cbf5f" />
          <Ellipse cx={20} cy={32} rx={11} ry={4.5} fill="#c9e88a" />
          <Rect x={7} y={33} width={4} height={4.5} rx={2} fill="#3f9c4a" />
          <Circle cx={9} cy={20} r={4.6} fill="#5cbf5f" />
          <Circle cx={16.5} cy={19} r={4.2} fill="#5cbf5f" />
          <Circle cx={8.5} cy={19.6} r={2.6} fill="#ffffff" />
          <Circle cx={16} cy={18.6} r={2.4} fill="#ffffff" />
          <Circle cx={7.6} cy={19.8} r={1.3} fill={INK} />
          <Circle cx={15.2} cy={18.8} r={1.2} fill={INK} />
          <Path
            d="M5 27 Q10 30 15 27.5"
            stroke={INK}
            strokeWidth={1.2}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    case 'duck':
      return (
        <>
          <Path
            d="M17 33 V38 M14.5 38 H19.5 M25 33 V38 M22.5 38 H27.5"
            stroke="#e8892a"
            strokeWidth={1.8}
            strokeLinecap="round"
          />
          <Ellipse cx={22} cy={27} rx={13} ry={7.5} fill="#fff3c4" />
          <Path d="M33 24 L38 20 L36 27 Z" fill="#fff3c4" />
          <Path d="M17 26 Q24 21 31 26 Q24 30 17 26 Z" fill="#f2dc8f" />
          <Rect x={9.5} y={16} width={5} height={10} rx={2.5} fill="#fff3c4" />
          <Circle cx={11.5} cy={14.5} r={6} fill="#fff3c4" />
          <Path d="M6.2 13.8 L0.8 15.8 L6 17.6 Z" fill="#f29a2e" />
          <Circle cx={9.6} cy={13.4} r={1.3} fill={INK} />
        </>
      );
    case 'kid': {
      const n = index % SHIRTS.length;
      return (
        <>
          <Rect x={15.5} y={28} width={4} height={10} rx={2} fill="#3d4a6b" />
          <Rect x={20.5} y={28} width={4} height={10} rx={2} fill="#3d4a6b" />
          <Rect x={13.5} y={16} width={13} height={14} rx={5} fill={SHIRTS[n]} />
          <Rect x={11} y={18} width={3.5} height={9} rx={1.75} fill={SKINS[n]} />
          <Circle cx={20} cy={9.5} r={6.5} fill={SKINS[n]} />
          <Path
            d="M13.5 9 A6.5 6.5 0 0 1 26.5 9 L26.5 13 Q23 9 20 7.5 Q16 8 13.5 9 Z"
            fill={HAIR[n]}
          />
          <Circle cx={16.6} cy={10.2} r={1.2} fill={INK} />
          <Path
            d="M14.5 13.2 Q16 14.2 17.5 13.4"
            stroke={INK}
            strokeWidth={0.9}
            fill="none"
            strokeLinecap="round"
          />
        </>
      );
    }
  }
}

/** One in the line, drawn facing the front so every phone shows the same queue. */
export function LineupArt({
  thing,
  index,
  size,
}: {
  thing: LineThing;
  index: number;
  size: number;
}) {
  return (
    // A child is tall and narrow, so it gets a taller box cropped to its own width.
    <Svg
      width={size}
      height={thing === 'kid' ? size * 1.6 : size}
      viewBox={thing === 'kid' ? '9.5 0 21 38' : '0 0 40 40'}
    >
      <Art thing={thing} index={index} />
    </Svg>
  );
}
