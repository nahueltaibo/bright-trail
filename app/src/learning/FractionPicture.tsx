import type { FractionVisual } from '@bright-trail/shared';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { colors } from './theme';

type Props = { visual: FractionVisual; width: number; height: number };

const SHADED = colors.dot;
const EMPTY = '#FFFFFF';

/** Rows and columns for a rectangle cut into `parts`, as square as the count allows. */
export function gridOf(parts: number): { rows: number; cols: number } {
  let rows = Math.floor(Math.sqrt(parts));
  while (parts % rows !== 0) rows--;
  return { rows, cols: parts / rows };
}

function sector(cx: number, cy: number, r: number, from: number, to: number): string {
  const point = (turn: number) => {
    // Turn 0 is twelve o'clock, going clockwise, the way kids cut a pizza.
    const angle = turn * 2 * Math.PI - Math.PI / 2;
    return `${cx + r * Math.cos(angle)} ${cy + r * Math.sin(angle)}`;
  };
  return `M ${cx} ${cy} L ${point(from)} A ${r} ${r} 0 0 1 ${point(to)} Z`;
}

const paint = (shaded: boolean, strokeWidth: number) => ({
  fill: shaded ? SHADED : EMPTY,
  stroke: colors.ink,
  strokeWidth,
  testID: shaded ? 'fraction-part-shaded' : 'fraction-part',
});

function Whole({
  visual,
  shadedHere,
  width,
  height,
}: {
  visual: FractionVisual;
  shadedHere: number;
  width: number;
  height: number;
}) {
  const stroke = Math.max(2, Math.min(width, height) * 0.02);
  const inset = stroke / 2;
  const { parts } = visual;
  const shapes = [];
  if (visual.shape === 'circle') {
    const r = Math.min(width, height) / 2 - inset;
    for (let i = 0; i < parts; i++) {
      shapes.push(
        <Path
          key={i}
          {...paint(i < shadedHere, stroke)}
          d={sector(width / 2, height / 2, r, i / parts, (i + 1) / parts)}
        />,
      );
    }
  } else {
    const { rows, cols } = visual.shape === 'bar' ? { rows: 1, cols: parts } : gridOf(parts);
    const w = (width - stroke) / cols;
    const h = (height - stroke) / rows;
    for (let i = 0; i < parts; i++) {
      shapes.push(
        <Rect
          key={i}
          {...paint(i < shadedHere, stroke)}
          x={inset + (i % cols) * w}
          y={inset + Math.floor(i / cols) * h}
          width={w}
          height={h}
        />,
      );
    }
  }
  return (
    <Svg width={width} height={height}>
      {shapes}
    </Svg>
  );
}

/**
 * Wholes sit side by side, or stacked for bars, the way fraction strips line up. Shading fills
 * the first whole before the next, so 7/4 reads as one full whole and 3 more parts.
 */
export function FractionPicture({ visual, width, height }: Props) {
  const wholes = visual.wholes ?? 1;
  const labelSize = visual.label ? Math.max(18, Math.min(height * 0.16, 44)) : 0;
  const room = height - (visual.label ? labelSize * 1.4 : 0);
  const gap = Math.min(width, room) * 0.06;
  const stacked = visual.shape === 'bar';

  let shapeWidth: number;
  let shapeHeight: number;
  if (stacked) {
    shapeWidth = width;
    shapeHeight = Math.min(width * 0.25, (room - gap * (wholes - 1)) / wholes);
  } else {
    const side = Math.min((width - gap * (wholes - 1)) / wholes, room);
    shapeWidth = side;
    shapeHeight = visual.shape === 'rectangle' ? side * 0.75 : side;
  }

  return (
    <View style={styles.column}>
      <View style={[stacked ? styles.column : styles.row, { gap }]}>
        {Array.from({ length: wholes }, (_, w) => (
          <Whole
            key={w}
            visual={visual}
            shadedHere={Math.min(visual.parts, Math.max(0, visual.shaded - w * visual.parts))}
            width={shapeWidth}
            height={shapeHeight}
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
