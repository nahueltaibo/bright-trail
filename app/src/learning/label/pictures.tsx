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

/** A body outline with the brain, lungs, heart, liver, stomach, and intestines inside. */
function Organs() {
  return (
    <G>
      <Rect x={170} y={68} width={20} height={16} fill={SKIN} />
      <Rect
        x={128}
        y={80}
        width={104}
        height={196}
        rx={44}
        fill={SKIN}
        stroke={INK}
        strokeWidth={1.5}
      />
      <Circle cx={180} cy={44} r={30} fill={SKIN} stroke={INK} strokeWidth={1.5} />
      <Ellipse cx={180} cy={34} rx={21} ry={14} fill="#F4A7B9" stroke={INK} strokeWidth={1.5} />
      <Path
        d="M 166 32 Q 172 26 178 32 T 190 32 M 170 40 Q 176 36 182 40 T 194 38"
        stroke="#C4677F"
        strokeWidth={2}
        fill="none"
      />
      <Ellipse cx={156} cy={124} rx={18} ry={30} fill="#F7B6C2" stroke={INK} strokeWidth={1.5} />
      <Ellipse cx={204} cy={124} rx={18} ry={30} fill="#F7B6C2" stroke={INK} strokeWidth={1.5} />
      <Path
        d="M 188 152 C 172 140 174 128 182 128 C 186 128 188 132 188 134 C 188 132 190 128 194 128 C 202 128 204 140 188 152 Z"
        fill="#E5484D"
        stroke={INK}
        strokeWidth={1.5}
      />
      <Path
        d="M 140 168 Q 170 160 190 170 Q 176 188 146 186 Q 136 180 140 168 Z"
        fill="#9C4A2F"
        stroke={INK}
        strokeWidth={1.5}
      />
      <Ellipse cx={204} cy={182} rx={16} ry={13} fill="#F7B267" stroke={INK} strokeWidth={1.5} />
      <Rect
        x={146}
        y={204}
        width={68}
        height={52}
        rx={16}
        fill="#F2A7A0"
        stroke={INK}
        strokeWidth={1.5}
      />
      <Path
        d="M 154 218 Q 164 210 174 218 T 194 218 T 206 222 M 154 236 Q 164 228 174 236 T 194 236 T 206 240"
        stroke="#C46A62"
        strokeWidth={3}
        fill="none"
        strokeLinecap="round"
      />
    </G>
  );
}

const METAL = '#8892A6';
const STEEL = '#C9CED8';
const WOOD = '#B07A3B';

/** The six simple machines, two to a row: lever and pulley, ramp and wheel, wedge and screw. */
function Machines() {
  const threads = [228, 236, 244, 252, 260];
  return (
    <G>
      <Path d="M 145 64 L 133 84 L 157 84 Z" fill={METAL} stroke={INK} strokeWidth={1.5} />
      <Line x1={108} y1={74} x2={182} y2={52} stroke={WOOD} strokeWidth={7} strokeLinecap="round" />
      <Circle cx={116} cy={62} r={8} fill={BUG} stroke={INK} strokeWidth={1.5} />

      <Line x1={190} y1={14} x2={240} y2={14} stroke={INK} strokeWidth={4} strokeLinecap="round" />
      <Line x1={215} y1={14} x2={215} y2={24} stroke={INK} strokeWidth={2} />
      <Line x1={203} y1={34} x2={203} y2={88} stroke={ROOT} strokeWidth={2} />
      <Line x1={227} y1={34} x2={227} y2={72} stroke={ROOT} strokeWidth={2} />
      <Circle cx={215} cy={34} r={12} fill={STEEL} stroke={INK} strokeWidth={2} />
      <Circle cx={215} cy={34} r={3} fill={INK} />
      <Rect
        x={217}
        y={72}
        width={20}
        height={18}
        rx={2}
        fill={SHIRT}
        stroke={INK}
        strokeWidth={1.5}
      />

      <Path d="M 110 182 L 184 182 L 184 136 Z" fill="#C9A26B" stroke={INK} strokeWidth={2} />
      <Circle cx={133} cy={161} r={7} fill={BUG} stroke={INK} strokeWidth={1.5} />

      <Line
        x1={215}
        y1={150}
        x2={252}
        y2={150}
        stroke={METAL}
        strokeWidth={6}
        strokeLinecap="round"
      />
      <Circle cx={215} cy={150} r={26} fill="none" stroke={INK} strokeWidth={4} />
      <Path
        d="M 215 124 L 215 176 M 189 150 L 241 150 M 197 132 L 233 168 M 233 132 L 197 168"
        stroke={INK}
        strokeWidth={1.5}
      />
      <Circle cx={215} cy={150} r={6} fill={METAL} stroke={INK} strokeWidth={1.5} />

      <Rect
        x={110}
        y={240}
        width={70}
        height={28}
        rx={6}
        fill={WOOD}
        stroke={INK}
        strokeWidth={1.5}
      />
      <Path d="M 145 248 L 145 268" stroke={INK} strokeWidth={1.5} />
      <Path d="M 132 208 L 158 208 L 145 248 Z" fill={METAL} stroke={INK} strokeWidth={2} />

      <Rect
        x={201}
        y={214}
        width={28}
        height={8}
        rx={3}
        fill={METAL}
        stroke={INK}
        strokeWidth={1.5}
      />
      <Rect x={208} y={222} width={14} height={44} fill={STEEL} stroke={INK} strokeWidth={1.5} />
      {threads.map((y) => (
        <Line key={y} x1={206} y1={y + 3} x2={224} y2={y - 3} stroke={INK} strokeWidth={2} />
      ))}
      <Path d="M 208 266 L 222 266 L 215 280 Z" fill={STEEL} stroke={INK} strokeWidth={1.5} />
    </G>
  );
}

/** Each planet's centre, size, and colour, in order out from the sun. */
const PLANETS = [
  { cx: 168, cy: 50, r: 6, fill: '#B5A99A' },
  { cx: 192, cy: 74, r: 9, fill: '#E8C07D' },
  { cx: 168, cy: 100, r: 9, fill: '#4F9BE8' },
  { cx: 192, cy: 124, r: 7, fill: '#D9603B' },
  { cx: 168, cy: 158, r: 15, fill: '#D8A878' },
  { cx: 192, cy: 202, r: 11, fill: '#E6CF8F' },
  { cx: 168, cy: 240, r: 9, fill: '#8FD8E0' },
  { cx: 192, cy: 272, r: 9, fill: '#4A6FE3' },
];
const STARS = [
  [112, 30],
  [244, 40],
  [120, 120],
  [246, 104],
  [230, 168],
  [114, 200],
  [244, 236],
  [124, 276],
];

/** The sun at the top, and the eight planets below it in order, in a strip of night sky. */
function Planets() {
  return (
    <G>
      <Rect x={100} y={0} width={160} height={300} rx={14} fill="#1F2A4A" />
      {STARS.map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.5} fill="#FFFFFF" />
      ))}
      <Circle cx={180} cy={-30} r={48} fill="#FFC93C" />
      {PLANETS.map((p) => (
        <Circle key={p.cy} cx={p.cx} cy={p.cy} r={p.r} fill={p.fill} />
      ))}
      <Circle cx={165} cy={98} r={3.5} fill="#4E9A3A" />
      <Path
        d="M 154 152 L 182 152 M 153 160 L 183 160 M 156 167 L 180 167"
        stroke="#A9744A"
        strokeWidth={2.5}
      />
      <Ellipse cx={192} cy={202} rx={22} ry={5} fill="none" stroke="#C9B27A" strokeWidth={2.5} />
    </G>
  );
}

const WATER = '#7EC8F0';
const RIVER = '#3A8FC9';
const TREE = '#4E9A3A';

/** A paper map with a title, compass rose, legend, and scale, and land and water on it. */
function MapArt() {
  const trees = [
    [208, 128],
    [222, 122],
    [236, 130],
    [214, 142],
    [230, 144],
  ];
  return (
    <G>
      <Rect
        x={100}
        y={18}
        width={160}
        height={268}
        rx={8}
        fill="#F3E9C6"
        stroke={INK}
        strokeWidth={1.5}
      />
      <Rect
        x={136}
        y={28}
        width={88}
        height={18}
        rx={4}
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={1}
      />
      <Line
        x1={146}
        y1={37}
        x2={214}
        y2={37}
        stroke={INK}
        strokeWidth={3}
        strokeDasharray={[8, 4]}
      />
      <Path
        d="M 234 60 L 238 72 L 250 76 L 238 80 L 234 92 L 230 80 L 218 76 L 230 72 Z"
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={1.5}
      />
      <Path d="M 234 60 L 238 72 L 230 72 Z" fill="#D9603B" />
      <Path
        d="M 112 100 L 132 66 L 152 100 Z M 136 100 L 154 74 L 172 100 Z"
        fill="#9AA3B2"
        stroke={INK}
        strokeWidth={1.5}
      />
      <Path d="M 126 76 L 132 66 L 138 76 Z M 149 81 L 154 74 L 159 81 Z" fill="#FFFFFF" />
      {trees.map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={9} fill={TREE} stroke={INK} strokeWidth={1} />
      ))}
      <Path
        d="M 162 160 Q 200 178 184 206 Q 168 234 178 258 Q 186 274 172 286"
        stroke={RIVER}
        strokeWidth={7}
        strokeLinecap="round"
        fill="none"
      />
      <Ellipse cx={144} cy={152} rx={26} ry={16} fill={WATER} stroke={RIVER} strokeWidth={2} />
      <Rect
        x={110}
        y={230}
        width={46}
        height={40}
        rx={4}
        fill="#FFFFFF"
        stroke={INK}
        strokeWidth={1}
      />
      <Rect x={115} y={236} width={8} height={6} fill={WATER} />
      <Circle cx={119} cy={250} r={3.5} fill={TREE} />
      <Path d="M 115 264 L 119 256 L 123 264 Z" fill="#9AA3B2" />
      <Path
        d="M 127 239 L 150 239 M 127 250 L 150 250 M 127 261 L 150 261"
        stroke={INK}
        strokeWidth={2}
      />
      {[0, 1, 2, 3].map((i) => (
        <Rect
          key={i}
          x={200 + i * 12}
          y={258}
          width={12}
          height={6}
          fill={i % 2 ? '#FFFFFF' : INK}
          stroke={INK}
          strokeWidth={1}
        />
      ))}
    </G>
  );
}

export const PICTURE_ART: Record<Picture, () => ReactElement> = {
  plant: Plant,
  insect: Insect,
  body: Body,
  organs: Organs,
  machines: Machines,
  planets: Planets,
  map: MapArt,
};
