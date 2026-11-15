import type { GridScene } from '@bright-trail/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { font, radius } from '../../design/tokens';
import { Text } from '../../design/Text';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { wait } from '../minigames/motion';
import { colors } from '../theme';
import {
  cellLines,
  fillSteps,
  filledBoxes,
  layoutOf,
  STAGE_H,
  STAGE_W,
  type Group,
} from './layout';
import { gridShout, partsText } from './words';

/** The two amounts of a same ask fill in different colours, so the child can tell them apart. */
const FILLS = ['#4FA3E0', '#FF7043'] as const;

export type GridStageHandle = {
  /** Fills each amount part by part, counting as it goes, then says what it filled. */
  play(): Promise<void>;
  /** Back to empty strips or grids. */
  reset(): Promise<void>;
};

type Props = {
  scene: GridScene;
  cheer?: boolean;
  /** Parts of the first amount filled before the play-out, which then counts them from 0. */
  filled?: number;
  handle?: Ref<GridStageHandle>;
};

/** Tenths strips or hundred grids that fill in for a grid scene. Driven through `handle`. */
export function GridStage({ scene: s, cheer, filled = 0, handle }: Props) {
  const layout = useMemo(() => layoutOf(s), [s]);
  const start = useMemo(
    () => layout.groups.map((_, g) => (g === 0 ? filled : 0)),
    [layout, filled],
  );
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [shown, setShown] = useState<number[]>(start);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [hop] = useState(() => new Animated.Value(0));
  const run = useRef(0);
  const ids = useRef(0);

  useEffect(() => {
    if (!cheer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 220, useNativeDriver: false }),
        Animated.timing(hop, { toValue: 0, duration: 220, useNativeDriver: false }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [cheer, hop]);

  useEffect(() => {
    const runs = run;
    return () => {
      runs.current += 1;
    };
  }, []);

  useImperativeHandle(handle, () => {
    const live = (t: number) => run.current === t;
    return {
      async play() {
        const t = run.current;
        for (let g = 0; g < layout.groups.length; g++) {
          const steps = fillSteps(layout.unit, layout.groups[g].fill);
          // About two seconds a group, however much it fills.
          const ms = Math.min(220, Math.max(60, 2000 / steps.length));
          for (const n of steps) {
            if (!live(t)) return;
            setShown((v) => v.map((x, i) => (i === g ? n : x)));
            await wait(ms);
          }
          await wait(250);
        }
        if (!live(t)) return;
        // The shout takes over the running counts, below the pictures, so it covers no card.
        const y = layout.groups[layout.groups.length - 1].count.y + 6;
        setBubbles([{ id: ids.current++, x: STAGE_W / 2, y, text: gridShout(s), big: true }]);
        await wait(900);
      },
      async reset() {
        run.current += 1;
        setShown(start);
        setBubbles([]);
        await wait(50);
      },
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };

  const scale = box ? Math.min(box.w / STAGE_W, box.h / STAGE_H) : 0;
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });

  return (
    <View style={styles.stage} onLayout={onLayout} testID="grid-stage">
      {box && scale > 0 && (
        <View
          style={[
            styles.world,
            { left: (box.w - STAGE_W) / 2, top: (box.h - STAGE_H) / 2, transform: [{ scale }] },
          ]}
        >
          <View style={styles.backdrop} />
          <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: hopY }] }]}>
            <Svg width={STAGE_W} height={STAGE_H} style={StyleSheet.absoluteFill}>
              {layout.groups.map((group, g) => (
                <GroupCells key={g} group={group} shown={shown[g]} fill={FILLS[g]} />
              ))}
            </Svg>
            {layout.groups.map((group, g) => (
              <View key={g} pointerEvents="none" style={StyleSheet.absoluteFill}>
                <View style={[styles.card, { left: group.card.x - 40, top: group.card.y - 15 }]}>
                  <Text style={styles.cardText}>{group.label}</Text>
                </View>
                <Text
                  testID="grid-count"
                  style={[styles.count, { left: group.count.x - 80, top: group.count.y - 11 }]}
                >
                  {shown[g] > 0 && bubbles.length === 0 ? partsText(shown[g], layout.unit) : ''}
                </Text>
              </View>
            ))}
          </Animated.View>
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
        </View>
      )}
    </View>
  );
}

function GroupCells({ group, shown, fill }: { group: Group; shown: number; fill: string }) {
  return (
    <>
      {group.wholes.map((w, i) => (
        <Rect key={`w${i}`} x={w.x} y={w.y} width={w.w} height={w.h} fill="#FFFFFF" />
      ))}
      {filledBoxes(group, shown).map((b, i) => (
        <Rect key={`f${i}`} x={b.x} y={b.y} width={b.w} height={b.h} fill={fill} />
      ))}
      {group.wholes.flatMap((w, i) =>
        cellLines(w).map((l, j) => (
          <Line key={`l${i}-${j}`} {...l} stroke={colors.line} strokeWidth={1} />
        )),
      )}
      {group.wholes.map((w, i) => (
        <Rect
          key={`o${i}`}
          x={w.x}
          y={w.y}
          width={w.w}
          height={w.h}
          fill="none"
          stroke={colors.ink}
          strokeWidth={2.5}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, margin: 8, overflow: 'hidden' },
  world: { position: 'absolute', width: STAGE_W, height: STAGE_H },
  backdrop: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  card: {
    position: 'absolute',
    width: 80,
    height: 30,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { ...font.display(800), fontSize: 17, color: colors.ink },
  count: {
    position: 'absolute',
    width: 160,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 15,
    color: colors.ink,
  },
});
