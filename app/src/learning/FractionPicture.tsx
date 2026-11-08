import type { FractionFood, FractionVisual } from '@bright-trail/shared';
import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Path, Use } from 'react-native-svg';
import { CRUMB, edgeLook, FoodArt, gapFill, PICKED_FILL, Underlay } from './food/FoodArt';
import { pickOffset, seeded, wholeOf, type Whole } from './food/geometry';
import { colors } from './theme';

type Props = { visual: FractionVisual; width: number; height: number };

/** Room around a whole for its plate and for picked slices to slide out. */
export const ROUND_ROOM = 1.36;
const GRID_ROOM = 0.16;

/** A whole fitted to its box, leaving room around it. */
export function fitWhole(
  visual: Pick<FractionVisual, 'shape' | 'parts'>,
  w: number,
  h: number,
  rot = 0,
) {
  if (visual.shape === 'circle') {
    const d = Math.min(w, h) / ROUND_ROOM;
    return wholeOf('circle', visual.parts, d, d, rot);
  }
  const m = Math.min(w, h) * GRID_ROOM;
  return wholeOf(visual.shape, visual.parts, w - 2 * m, h - 2 * m);
}

/** Dashed outlines and crumbs where slices left, drawn under the slices so only gaps show. */
export function Gaps({ whole, food, at }: { whole: Whole; food?: FractionFood; at: number[] }) {
  return (
    <>
      {at.map((i) => {
        const p = whole.pieces[i];
        const rnd = seeded(i * 13 + whole.parts);
        return (
          <G key={i}>
            <Path
              d={p.d}
              fill={gapFill(food)}
              stroke={food ? '#C2AE7E' : colors.line}
              strokeWidth={2}
              strokeDasharray="5 5"
              strokeLinejoin="round"
            />
            {food &&
              [0, 1, 2].map((k) => (
                <Circle
                  key={k}
                  cx={p.c.x + (rnd() - 0.5) * whole.unit * 0.4}
                  cy={p.c.y + (rnd() - 0.5) * whole.unit * 0.3}
                  r={1.4 + rnd() * 1.4}
                  fill={CRUMB[food]}
                  opacity={0.8}
                />
              ))}
          </G>
        );
      })}
    </>
  );
}

function WholeView({
  visual,
  picked,
  gone,
  width,
  height,
}: {
  visual: FractionVisual;
  picked: Set<number>;
  gone: Set<number>;
  width: number;
  height: number;
}) {
  // Ids end up in url(#…), which can't take the colons useId returns.
  const id = `fp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const { food } = visual;
  const whole = fitWhole(visual, width, height);
  const off = pickOffset(whole, picked, gone);
  const moved = whole.pieces.map((_, i) => i).filter((i) => picked.has(i) || gone.has(i));
  return (
    <Svg width={width} height={height}>
      <Defs>
        <G id={`${id}art`}>
          <FoodArt food={food} whole={whole} />
        </G>
        {whole.pieces.map((p, i) => (
          <ClipPath key={i} id={`${id}c${i}`}>
            <Path d={p.d} />
          </ClipPath>
        ))}
      </Defs>
      <G x={width / 2} y={height / 2}>
        <Underlay food={food} whole={whole} />
        <Gaps whole={whole} food={food} at={moved} />
        {[...gone].map((i) => (
          <Path key={`e${i}`} d={whole.pieces[i].d} fill="none" testID="fraction-part-eaten" />
        ))}
        {whole.pieces.map((p, i) => {
          if (gone.has(i)) return null;
          const on = picked.has(i);
          return (
            <G key={i} x={on ? off.x : 0} y={on ? off.y : 0}>
              {on && food && <Path d={p.d} fill={colors.ink} opacity={0.22} x={2} y={5} />}
              <G clipPath={`url(#${id}c${i})`}>
                <Use href={`#${id}art`} />
              </G>
              {on && !food && <Path d={p.d} fill={PICKED_FILL} />}
              <Path
                d={p.d}
                fill="none"
                strokeLinejoin="round"
                {...edgeLook(food)}
                testID={on ? 'fraction-part-picked' : 'fraction-part'}
              />
            </G>
          );
        })}
      </G>
    </Svg>
  );
}

/**
 * Wholes sit side by side, or stacked for bars, the way fraction strips line up. Picked slices
 * fill the first whole before the next and slide out together, so 7/4 reads as one whole pulled
 * out and 3 more parts. Eaten slices come off the end and leave a gap.
 */
export function FractionPicture({ visual, width, height }: Props) {
  const wholes = visual.wholes ?? 1;
  const labelSize = visual.label ? Math.max(18, Math.min(height * 0.16, 44)) : 0;
  const room = height - (visual.label ? labelSize * 1.4 : 0);
  const gap = Math.min(width, room) * 0.02;
  const stacked = visual.shape === 'bar';

  let boxW: number;
  let boxH: number;
  if (stacked) {
    boxW = width;
    boxH = Math.min(width * 0.32, (room - gap * (wholes - 1)) / wholes);
  } else {
    const side = Math.min((width - gap * (wholes - 1)) / wholes, room);
    boxW = side;
    boxH = visual.shape === 'rectangle' ? side * 0.8 : side;
  }
  const total = visual.parts * wholes;
  const eatenFrom = total - (visual.eaten ?? 0);
  const setOf = (w: number, test: (g: number) => boolean) =>
    new Set(
      Array.from({ length: visual.parts }, (_, i) => i).filter((i) => test(w * visual.parts + i)),
    );

  return (
    <View style={styles.column}>
      <View style={[stacked ? styles.column : styles.row, { gap }]}>
        {Array.from({ length: wholes }, (_, w) => (
          <WholeView
            key={w}
            visual={visual}
            picked={setOf(w, (g) => g < visual.picked)}
            gone={setOf(w, (g) => g >= eatenFrom)}
            width={boxW}
            height={boxH}
          />
        ))}
      </View>
      {visual.label && (
        <Text style={[styles.label, { fontSize: labelSize, lineHeight: labelSize * 1.3 }]}>
          {visual.label}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  column: { alignItems: 'center' },
  label: { color: colors.ink, fontWeight: '700', textAlign: 'center' },
});
