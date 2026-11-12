import type { Picture } from '@bright-trail/shared';
import type { ReactElement } from 'react';
import { Circle, Ellipse, G, Line, Path, Rect } from 'react-native-svg';

const INK = '#5a4a1f';
const STEM = '#4E9A3A';
const LEAF = '#7CC35B';
const PETAL = '#FF8FB1';
const SOIL = '#B98B5E';
const ROOT = '#7A5230';
const BUG = '#5C7CFA';
const WING = '#CFE3FF';
const SKIN = '#F2C9A0';
const SHIRT = '#FFB347';
const PANTS = '#5C7CFA';

/** A flower in soil, with a seed beside it. */
function Plant() {
  return (
    <G>
      <Rect x={96} y={204} width={168} height={84} rx={12} fill={SOIL} />
      <Path
        d="M 180 204 L 180 236 M 180 222 L 160 250 M 180 228 L 202 254 M 180 236 L 174 268 M 166 242 L 150 258"
        stroke={ROOT}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={232} cy={232} rx={9} ry={6} fill="#E7C27A" stroke={ROOT} strokeWidth={2} />
      <Line
        x1={180}
        y1={84}
        x2={180}
        y2={206}
        stroke={STEM}
        strokeWidth={7}
        strokeLinecap="round"
      />
      <Path
        d="M 180 160 Q 148 128 136 150 Q 152 168 180 160 Z"
        fill={LEAF}
        stroke={STEM}
        strokeWidth={2}
      />
      <Path
        d="M 180 136 Q 214 104 226 126 Q 208 146 180 136 Z"
        fill={LEAF}
        stroke={STEM}
        strokeWidth={2}
      />
      {[0, 72, 144, 216, 288].map((a) => {
        const r = (a * Math.PI) / 180;
        return (
          <Circle
            key={a}
            cx={180 + Math.cos(r) * 17}
            cy={58 + Math.sin(r) * 17}
            r={14}
            fill={PETAL}
          />
        );
      })}
      <Circle cx={180} cy={58} r={11} fill="#FFD23F" stroke={INK} strokeWidth={1.5} />
    </G>
  );
}

/** An insect from above: head, thorax, abdomen, six legs, two antennae, and wings. */
function Insect() {
  const legs = [130, 150, 170].flatMap((x, i) => [
    `M ${x} 150 L ${x - 14 + i * 6} 116 L ${x - 22 + i * 10} 104`,
    `M ${x} 150 L ${x - 14 + i * 6} 184 L ${x - 22 + i * 10} 200`,
  ]);
  return (
    <G>
      {legs.map((d) => (
        <Path key={d} d={d} stroke={INK} strokeWidth={3} strokeLinecap="round" fill="none" />
      ))}
      <Path
        d="M 102 140 Q 92 112 80 100 M 106 138 Q 104 108 96 92"
        stroke={INK}
        strokeWidth={2.5}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={216} cy={152} rx={44} ry={24} fill={BUG} stroke={INK} strokeWidth={2} />
      <Ellipse cx={150} cy={150} rx={22} ry={17} fill={BUG} stroke={INK} strokeWidth={2} />
      <Circle cx={110} cy={150} r={17} fill={BUG} stroke={INK} strokeWidth={2} />
      <Circle cx={104} cy={144} r={3} fill="#FFFFFF" />
      <Ellipse
        cx={192}
        cy={118}
        rx={40}
        ry={14}
        fill={WING}
        fillOpacity={0.85}
        stroke={INK}
        strokeWidth={1.5}
      />
    </G>
  );
}

/** A child standing, arms out a little. */
function Body() {
  return (
    <G>
      <Path
        d="M 160 90 L 130 140 M 200 90 L 230 140"
        stroke={SKIN}
        strokeWidth={14}
        strokeLinecap="round"
      />
      <Circle cx={118} cy={164} r={11} fill={SKIN} stroke={INK} strokeWidth={1.5} />
      <Circle cx={242} cy={164} r={11} fill={SKIN} stroke={INK} strokeWidth={1.5} />
      <Path
        d="M 130 140 L 120 156 M 230 140 L 240 156"
        stroke={SKIN}
        strokeWidth={12}
        strokeLinecap="round"
      />
      <Path
        d="M 168 160 L 166 252 M 192 160 L 194 252"
        stroke={PANTS}
        strokeWidth={18}
        strokeLinecap="round"
      />
      <Rect
        x={152}
        y={80}
        width={56}
        height={84}
        rx={14}
        fill={SHIRT}
        stroke={INK}
        strokeWidth={1.5}
      />
      <Ellipse cx={160} cy={262} rx={18} ry={9} fill={INK} />
      <Ellipse cx={200} cy={262} rx={18} ry={9} fill={INK} />
      <Circle cx={180} cy={50} r={26} fill={SKIN} stroke={INK} strokeWidth={1.5} />
      <Circle cx={171} cy={47} r={3} fill={INK} />
      <Circle cx={189} cy={47} r={3} fill={INK} />
      <Path
        d="M 172 60 Q 180 66 188 60"
        stroke={INK}
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
      />
    </G>
  );
}

export const PICTURE_ART: Record<Picture, () => ReactElement> = {
  plant: Plant,
  insect: Insect,
  body: Body,
};
