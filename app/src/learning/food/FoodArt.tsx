import type { FractionFood } from '@bright-trail/shared';
import type { ReactElement } from 'react';
import { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';
import { seeded, turnPoint, wobble, type Whole } from './geometry';

/** Crumbs a bite leaves, and the gap a gone slice leaves on its plate or tray. */
export const CRUMB: Record<FractionFood, string> = {
  pizza: '#E2A85A',
  pie: '#C98A3E',
  cookie: '#B57B3E',
  brownies: '#4A2817',
  chocolate: '#4F2A14',
  granola: '#C99545',
};
export const PICKED_FILL = colors.dot;
const GAP: Record<FractionFood | 'plain', string> = {
  pizza: '#F6EEDC',
  pie: '#F6EEDC',
  cookie: '#F6EEDC',
  brownies: '#BAC1C8',
  chocolate: '#E3E6EA',
  granola: '#E9E2D2',
  plain: '#FFFFFF',
};
export const gapFill = (food: FractionFood | undefined) => GAP[food ?? 'plain'];

/** The plate or tray under a whole, so a gap shows where slices left. */
export function Underlay({ food, whole }: { food?: FractionFood; whole: Whole }) {
  const { W, H, r } = whole;
  if (!food) return null;
  if (whole.round) {
    return (
      <G>
        <Circle r={r * 1.13} fill="#FFFFFF" stroke="#E4D7B8" strokeWidth={2} />
        <Circle r={r} fill="#FBF6EA" />
      </G>
    );
  }
  if (food === 'brownies') {
    return (
      <G>
        <Rect
          x={-W / 2 - 10}
          y={-H / 2 - 10}
          width={W + 20}
          height={H + 20}
          rx={9}
          fill="#A9B1BA"
          stroke="#868E98"
          strokeWidth={2}
        />
        <Rect x={-W / 2 - 3} y={-H / 2 - 3} width={W + 6} height={H + 6} rx={4} fill="#C3C9D0" />
      </G>
    );
  }
  if (food === 'chocolate') {
    return (
      <Rect
        x={-W / 2 - 8}
        y={-H / 2 - 8}
        width={W + 16}
        height={H + 16}
        rx={6}
        fill="#D9DDE2"
        stroke="#B4BAC2"
        strokeWidth={2}
      />
    );
  }
  return (
    <Rect
      x={-W / 2 - 7}
      y={-H / 2 - 7}
      width={W + 14}
      height={H + 14}
      rx={8}
      fill="#F1E4C6"
      stroke="#D9C59B"
      strokeWidth={2}
    />
  );
}

// Rotated shapes are drawn as paths: react-native-svg on web turns any transform into a
// transform-origin attribute, which React rejects.

/** An ellipse at x, y turned `deg` degrees. */
function ellipse(x: number, y: number, rx: number, ry: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  const dx = rx * Math.cos(a);
  const dy = rx * Math.sin(a);
  const arc = `A ${rx} ${ry} ${deg} 1 0`;
  return `M ${x + dx} ${y + dy} ${arc} ${x - dx} ${y - dy} ${arc} ${x + dx} ${y + dy} Z`;
}

/** A rectangle's corners turned `deg` degrees about 0, 0. */
function turnedRect(x: number, y: number, w: number, h: number, deg: number): string {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const pts = [
    [x, y],
    [x + w, y],
    [x + w, y + h],
    [x, y + h],
  ].map(([px, py]) => `${px * c - py * s} ${px * s + py * c}`);
  return `M ${pts.join(' L ')} Z`;
}

function roundArt(food: FractionFood | undefined, r: number): ReactElement[] {
  const out: ReactElement[] = [];
  let k = 0;
  const circle = (cx: number, cy: number, rr: number, fill: string, extra: object = {}) =>
    out.push(<Circle key={k++} cx={cx} cy={cy} r={rr} fill={fill} {...extra} />);
  if (food === 'pizza') {
    circle(0, 0, r, '#DE9A4A', { stroke: '#B5732C', strokeWidth: r * 0.025 });
    circle(0, 0, r * 0.93, '#E9AE5E');
    circle(0, 0, r * 0.84, '#C93A24');
    out.push(<Path key={k++} d={wobble(r * 0.79, 0.025, 1.3)} fill="#F5C94F" />);
    const rnd = seeded(7);
    for (let i = 0; i < 16; i++) {
      const a = rnd() * 6.283;
      const d = Math.sqrt(rnd()) * r * 0.7;
      const x = d * Math.cos(a);
      const y = d * Math.sin(a);
      out.push(
        <Path key={k++} d={ellipse(x, y, r * 0.06, r * 0.035, rnd() * 180)} fill="#FBE08A" />,
      );
    }
    const spots = [
      [0.55, 0.3],
      [0.58, 1.35],
      [0.3, 2.2],
      [0.6, 2.75],
      [0.52, 3.6],
      [0.28, 4.45],
      [0.6, 4.95],
      [0.56, 5.85],
      [0.08, 0.6],
      [0.32, 1.0],
      [0.36, 3.15],
      [0.33, 5.4],
    ];
    for (const [d, a] of spots) {
      const x = d * r * Math.cos(a);
      const y = d * r * Math.sin(a);
      circle(x, y, r * 0.1, '#A82A22');
      circle(x - r * 0.025, y - r * 0.025, r * 0.035, '#C8473B');
    }
    for (const [d, a] of [
      [0.45, 0.8],
      [0.7, 2.1],
      [0.45, 4.0],
      [0.66, 5.5],
      [0.18, 3.0],
    ]) {
      const x = d * r * Math.cos(a);
      const y = d * r * Math.sin(a);
      out.push(<Path key={k++} d={ellipse(x, y, r * 0.05, r * 0.025, a * 50)} fill="#4E8B3A" />);
    }
  } else if (food === 'pie') {
    circle(0, 0, r, '#D08734', { stroke: '#A3621F', strokeWidth: r * 0.025 });
    circle(0, 0, r * 0.84, '#8E2443');
    const rnd = seeded(3);
    for (let i = 0; i < 20; i++) {
      const a = rnd() * 6.283;
      const d = Math.sqrt(rnd()) * r * 0.75;
      circle(d * Math.cos(a), d * Math.sin(a), r * 0.07, '#B23455');
    }
    // Lattice strips, kept inside the filling by stopping each strip at the rim.
    for (const rot of [45, -45]) {
      for (let s = -2; s <= 2; s++) {
        const x = s * r * 0.3;
        const half = Math.sqrt(Math.max(0, (r * 0.84) ** 2 - x * x));
        out.push(
          <Path
            key={k++}
            d={turnedRect(x - r * 0.07, -half, r * 0.14, 2 * half, rot)}
            fill="#E8AE5C"
            stroke="#B8772E"
            strokeWidth={r * 0.015}
          />,
        );
      }
    }
    for (let i = 0; i < 28; i++) {
      const p = turnPoint(r * 0.91, i / 28);
      circle(p.x, p.y, r * 0.075, i % 2 ? '#E2A04B' : '#D9953F', {
        stroke: '#B07028',
        strokeWidth: r * 0.012,
      });
    }
  } else if (food === 'cookie') {
    out.push(
      <Path
        key={k++}
        d={wobble(r, 0.012, 2)}
        fill="#C98D4C"
        stroke="#9E6A33"
        strokeWidth={r * 0.025}
      />,
    );
    out.push(<Path key={k++} d={wobble(r * 0.88, 0.015, 4)} fill="#D9A262" />);
    const rnd = seeded(11);
    for (let i = 0; i < 14; i++) {
      const a = rnd() * 6.283;
      const d = Math.sqrt(rnd()) * r * 0.72;
      const s = r * (0.07 + rnd() * 0.04);
      const x = d * Math.cos(a);
      const y = d * Math.sin(a);
      out.push(
        <Path
          key={k++}
          d={`M ${x - s} ${y} Q ${x - s * 0.4} ${y - s * 1.1} ${x + s} ${y - s * 0.2} Q ${x + s * 0.6} ${y + s} ${x - s} ${y} Z`}
          fill="#4A2A17"
        />,
      );
    }
  } else {
    circle(0, 0, r, '#FFFFFF');
  }
  return out;
}

function rectArt(food: FractionFood | undefined, whole: Whole): ReactElement[] {
  const { W, H, pieces } = whole;
  const x0 = -W / 2;
  const y0 = -H / 2;
  const out: ReactElement[] = [];
  let k = 0;
  if (food === 'brownies') {
    out.push(<Rect key={k++} x={x0} y={y0} width={W} height={H} fill="#6A3B22" />);
    const rnd = seeded(5);
    for (let i = 0; i < 26; i++) {
      const x = x0 + rnd() * W;
      const y = y0 + rnd() * H;
      const l = 6 + rnd() * 12;
      out.push(
        <Path
          key={k++}
          d={`M ${x} ${y} l ${l * 0.6} ${-l * 0.3} l ${l * 0.5} ${l * 0.35}`}
          stroke="#8C5634"
          strokeWidth={1.6}
          fill="none"
          strokeLinecap="round"
        />,
      );
    }
    for (let i = 0; i < 18; i++)
      out.push(
        <Circle
          key={k++}
          cx={x0 + rnd() * W}
          cy={y0 + rnd() * H}
          r={1.5 + rnd() * 1.5}
          fill="#3E2112"
        />,
      );
  } else if (food === 'chocolate') {
    out.push(<Rect key={k++} x={x0} y={y0} width={W} height={H} fill="#4F2A14" />);
    for (const p of pieces) {
      const i = Math.min(p.w, p.h) * 0.12;
      const x = p.c.x - p.w / 2;
      const y = p.c.y - p.h / 2;
      out.push(
        <Rect
          key={k++}
          x={x + i}
          y={y + i}
          width={p.w - 2 * i}
          height={p.h - 2 * i}
          rx={3}
          fill="#6E3D1F"
        />,
      );
      out.push(
        <Rect
          key={k++}
          x={x + i * 1.6}
          y={y + i * 1.6}
          width={p.w - 3.2 * i}
          height={(p.h - 3.2 * i) * 0.35}
          rx={2}
          fill="#8A5230"
          opacity={0.7}
        />,
      );
    }
  } else if (food === 'granola') {
    out.push(<Rect key={k++} x={x0} y={y0} width={W} height={H} fill="#D3A055" />);
    const rnd = seeded(9);
    for (let i = 0; i < W / 3; i++) {
      const x = x0 + rnd() * W;
      const y = y0 + rnd() * H;
      const rx = 3 + rnd() * 2;
      const fill = rnd() > 0.82 ? '#6B3B2A' : '#EBC889';
      out.push(<Path key={k++} d={ellipse(x, y, rx, 1.8, rnd() * 180)} fill={fill} />);
    }
  } else {
    out.push(<Rect key={k++} x={x0} y={y0} width={W} height={H} fill="#FFFFFF" />);
  }
  return out;
}

/** The whole food, uncut, centered on 0,0. Slices show it through their own clip. */
export function FoodArt({ food, whole }: { food?: FractionFood; whole: Whole }) {
  return <G>{whole.round ? roundArt(food, whole.r) : rectArt(food, whole)}</G>;
}

/** The line around a slice: dark on plain shapes, a soft cut line on food. */
export const edgeLook = (food: FractionFood | undefined) =>
  food
    ? { stroke: 'rgba(70,40,15,0.45)', strokeWidth: 1.4 }
    : { stroke: colors.ink, strokeWidth: 2.5 };
