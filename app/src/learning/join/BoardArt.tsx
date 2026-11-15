import { Fragment, type ReactNode } from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';
import {
  STAGE_H,
  STAGE_W,
  TWO_FRAME_CELL,
  WIRE_POLES,
  WIRE_ROWS,
  WIRE_SAG,
  trayOf,
  wireY,
  type Board,
} from './board';

const INK = '#5A4A1F';
const LINE = '#C9B98A';
const CELL_EDGE = '#E4D7B8';

function Sky() {
  return (
    <>
      <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#E3F3FF" />
      {[
        [60, 40, 1],
        [300, 60, 0.8],
        [190, 26, 0.6],
      ].map(([x, y, s]) => (
        <G key={x} x={x} y={y} scale={s} fill="#FFFFFF">
          <Ellipse cx={0} cy={0} rx={30} ry={12} />
          <Ellipse cx={-12} cy={-8} rx={14} ry={11} />
          <Ellipse cx={10} cy={-10} rx={16} ry={13} />
        </G>
      ))}
    </>
  );
}

function Table() {
  return <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#FFF4D6" />;
}

function Grass({ top }: { top: number }) {
  return (
    <Path
      d={`M 0 ${top} Q 90 ${top - 8} 180 ${top} T ${STAGE_W} ${top} V ${STAGE_H} H 0 Z`}
      fill="#CFEAB4"
    />
  );
}

function Tray({ cells, cell }: { cells: Board['cells']; cell: number }) {
  const tray = trayOf(cells, cell);
  return (
    <>
      <Rect
        x={tray.x}
        y={tray.y}
        width={tray.w}
        height={tray.h}
        rx={16}
        fill="#FFFFFF"
        stroke={LINE}
        strokeWidth={2}
      />
      {cells.map((p, i) => (
        <Rect
          key={i}
          x={p.x - cell / 2}
          y={p.y - cell / 2}
          width={cell}
          height={cell}
          rx={10}
          fill="#FBF6EA"
          stroke={CELL_EDGE}
          strokeWidth={1.5}
        />
      ))}
    </>
  );
}

function Pad({ x, y }: { x: number; y: number }) {
  const r = 25;
  const P = (a: number) => `${x + r * Math.cos(a)} ${y + r * Math.sin(a)}`;
  return (
    <Path
      d={`M ${x} ${y} L ${P(-0.45)} A ${r} ${r} 0 1 1 ${P(-0.95)} Z`}
      fill="#8BCB72"
      stroke="#5E9E4C"
      strokeWidth={2}
      strokeLinejoin="round"
    />
  );
}

/** Somewhere to set things aside in a part story: a leaf on grass, a mat elsewhere. */
function Aside({ board }: { board: Board }) {
  const m = board.mat;
  if (!m) return null;
  if (board.place === 'grass' || board.place === 'pond') {
    // The leaf is drawn for a 260 × 52 mat, then stretched to this one.
    const sx = m.w / 260;
    const sy = m.h / 52;
    return (
      <G transform={`translate(${m.x + m.w / 2} ${m.y + m.h / 2 + 6 * sy}) scale(${sx} ${sy})`}>
        <Path
          d="M -120 0 Q -40 -42 110 -6 Q 126 0 110 6 Q -40 42 -120 0 Z"
          fill="#7CC36E"
          stroke="#4F8F43"
          strokeWidth={2.5}
        />
        <Path d="M -112 0 Q 0 -4 112 0" fill="none" stroke="#4F8F43" strokeWidth={2} />
      </G>
    );
  }
  return (
    <Rect
      x={m.x}
      y={m.y}
      width={m.w}
      height={m.h}
      rx={m.h / 2}
      fill="#FFFFFF"
      stroke={LINE}
      strokeWidth={2}
    />
  );
}

/** The place and its ten-frame, drawn once under the things. */
export function BoardArt({ board }: { board: Board }) {
  const { place, cells } = board;
  let scene: ReactNode;
  if (board.frames === 2) {
    scene = (
      <>
        {place === 'sky' ? <Sky /> : <Table />}
        {place === 'grass' && <Grass top={250} />}
        <Tray cells={cells.slice(0, 10)} cell={TWO_FRAME_CELL} />
        <Tray cells={cells.slice(10)} cell={TWO_FRAME_CELL} />
      </>
    );
  } else if (place === 'pond') {
    scene = (
      <>
        <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} fill="#CFEAB4" />
        <Rect
          x={14}
          y={36}
          width={332}
          height={170}
          rx={70}
          fill="#BFE6F5"
          stroke="#9CD3EA"
          strokeWidth={3}
        />
        {cells.map((p, i) => (
          <Pad key={i} x={p.x} y={p.y} />
        ))}
      </>
    );
  } else if (place === 'bus') {
    scene = (
      <>
        <Sky />
        <Rect x={0} y={236} width={STAGE_W} height={54} fill="#D9D2C2" />
        {Array.from({ length: 9 }, (_, i) => (
          <Rect key={i} x={10 + i * 44} y={270} width={22} height={4} rx={2} fill="#FFFFFF" />
        ))}
        <Rect
          x={26}
          y={54}
          width={310}
          height={160}
          rx={22}
          fill="#FFC94A"
          stroke="#C9932A"
          strokeWidth={3}
        />
        <Rect x={26} y={186} width={310} height={10} fill="#E8A92E" />
        <Circle cx={330} cy={170} r={6} fill="#FFF4D6" stroke="#C9932A" strokeWidth={2} />
        {cells.map((p, i) => (
          <Rect
            key={i}
            x={p.x - 24}
            y={p.y - 24}
            width={48}
            height={48}
            rx={8}
            fill="#DDF1FF"
            stroke="#C9932A"
            strokeWidth={2.5}
          />
        ))}
        {[86, 270].map((x) => (
          <Fragment key={x}>
            <Circle cx={x} cy={216} r={20} fill={INK} />
            <Circle cx={x} cy={216} r={8} fill={LINE} />
          </Fragment>
        ))}
      </>
    );
  } else if (place === 'wires') {
    const [a, b] = WIRE_POLES;
    scene = (
      <>
        <Sky />
        {WIRE_POLES.map((x) => (
          <Rect key={x} x={x - 6} y={70} width={12} height={220} rx={3} fill="#A9855A" />
        ))}
        {WIRE_ROWS.map((row) => (
          <Path
            key={row}
            d={`M ${a} ${row} Q 180 ${row + WIRE_SAG} ${b} ${row}`}
            fill="none"
            stroke={INK}
            strokeWidth={2.5}
          />
        ))}
        {cells.map((p, i) => (
          <Circle
            key={i}
            cx={p.x}
            cy={wireY(WIRE_ROWS[i < 5 ? 0 : 1], p.x)}
            r={4}
            fill="#FFFFFF"
            stroke={LINE}
            strokeWidth={1.5}
          />
        ))}
      </>
    );
  } else {
    scene = (
      <>
        {place === 'sky' ? <Sky /> : <Table />}
        {place === 'grass' && <Grass top={196} />}
        <Tray cells={cells} cell={54} />
      </>
    );
  }
  return (
    <Svg width={STAGE_W} height={STAGE_H}>
      {scene}
      <Aside board={board} />
    </Svg>
  );
}
