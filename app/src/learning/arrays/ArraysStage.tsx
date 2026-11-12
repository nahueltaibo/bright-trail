import { THINGS, type ArrayScene } from '@bright-trail/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { font, radius } from '../../design/tokens';
import { Text } from '../../design/Text';
import { WholeThing } from '../food/ThingArt';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { frames, wait } from '../minigames/motion';
import { foodOf } from '../minigames/share';
import { colors } from '../theme';
import { layoutOf, STAGE_H, STAGE_W, turned } from './layout';
import { factLine, shout } from './words';

/** Counters for a plain array. A split's second part takes the other colour. */
const COUNTERS = ['#FF7043', '#4FA3E0'] as const;
const PART_BG = ['#FFE3D6', '#D8ECFA'] as const;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export type ArraysStageHandle = {
  /** Fills, deals, turns, or splits the array, then shouts what it found. */
  play(): Promise<void>;
  /** Back to the start. */
  reset(): Promise<void>;
};

type Props = { scene: ArrayScene; cheer?: boolean; handle?: Ref<ArraysStageHandle> };

/** One thing in its cell: food art, the thing's emoji, or a plain counter. */
function Thing({ scene, size, part }: { scene: ArrayScene; size: number; part: 0 | 1 }) {
  const food = scene.thing && foodOf(scene.thing, scene.thing);
  if (food) return <WholeThing food={food} size={size} />;
  if (scene.thing) {
    return (
      <Text
        style={{
          width: size,
          height: size,
          fontSize: size * 0.72,
          lineHeight: size,
          textAlign: 'center',
        }}
      >
        {THINGS[scene.thing].emoji}
      </Text>
    );
  }
  const d = size * 0.78;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: COUNTERS[part] }} />
    </View>
  );
}

/** Things in rows and columns for an array scene. Driven through `handle`. */
export function ArraysStage({ scene: s, cheer, handle }: Props) {
  const layout = useMemo(() => layoutOf(s), [s]);
  const all = layout.cells.length;
  // Rows and columns asks start empty, since the full array would show the answer.
  const filled = s.ask !== 'rows' && s.ask !== 'columns';
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [shown, setShown] = useState(filled ? all : 0);
  /** Rows a `total` ask has counted so far. -1 before the play-out. */
  const [counted, setCounted] = useState(-1);
  const [turn, setTurn] = useState(0);
  const [apart, setApart] = useState(0);
  const [done, setDone] = useState(false);
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
        if (s.ask === 'turn') {
          await frames(
            1100,
            (k) => live(t) && setTurn(ease(k)),
            () => live(t),
          );
        } else if (s.ask === 'split') {
          await frames(
            700,
            (k) => live(t) && setApart(ease(k)),
            () => live(t),
          );
        } else if (s.ask === 'total') {
          const ms = Math.min(520, Math.max(220, 3200 / s.rows));
          for (let r = 0; r <= s.rows; r++) {
            if (!live(t)) return;
            setCounted(r);
            await wait(r === 0 ? 150 : ms);
          }
        } else {
          // Fills a row, or one more in every row, per step, so the count lands on whole rows.
          const step = s.ask === 'columns' ? s.rows : s.columns;
          const ms = Math.min(520, Math.max(220, 3200 / (all / step)));
          for (let n = step; n <= all; n += step) {
            if (!live(t)) return;
            setShown(n);
            await wait(ms);
          }
        }
        if (!live(t)) return;
        await wait(200);
        if (!live(t)) return;
        setDone(true);
        setBubbles((b) => [
          ...b,
          { id: ids.current++, x: STAGE_W / 2, y: STAGE_H - 18, text: shout(s), big: true },
        ]);
        await wait(900);
      },
      async reset() {
        run.current += 1;
        setShown(filled ? all : 0);
        setCounted(-1);
        setTurn(0);
        setApart(0);
        setDone(false);
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
  const c = layout.cell;
  const rowsDone =
    s.ask === 'total'
      ? Math.max(0, counted)
      : s.ask === 'columns'
        ? done
          ? s.rows
          : 0
        : Math.floor(shown / s.columns);
  const rowLabel = (r: number) =>
    s.ask === 'total'
      ? String((r + 1) * s.columns)
      : s.ask === 'rows'
        ? String(r + 1)
        : String(s.columns);
  const showRowLabels = s.ask === 'total' || s.ask === 'rows' || s.ask === 'columns';

  return (
    <View style={styles.stage} onLayout={onLayout} testID="arrays-stage">
      {box && scale > 0 && (
        <View
          style={[
            styles.world,
            { left: (box.w - STAGE_W) / 2, top: (box.h - STAGE_H) / 2, transform: [{ scale }] },
          ]}
        >
          <View style={styles.backdrop} />
          <Text style={[styles.fact, done && styles.factDone]}>{factLine(s, done)}</Text>
          {s.ask === 'split' &&
            apart > 0 &&
            layout.partLabels!.map((p, i) => {
              const part = layout.cells.filter((x) => x.part === i);
              const rows = new Set(part.map((x) => x.row)).size;
              const columns = new Set(part.map((x) => x.column)).size;
              return (
                <Text
                  key={i}
                  testID="arrays-part"
                  style={[
                    styles.part,
                    { left: p.x - 30, top: p.y - 10, opacity: apart, color: COUNTERS[i] },
                  ]}
                >
                  {`${rows} × ${columns}`}
                </Text>
              );
            })}
          {showRowLabels &&
            layout.rowY.slice(0, rowsDone).map((y, r) => (
              <Text
                key={r}
                testID="arrays-row-label"
                style={[styles.rowLabel, { left: layout.labelX - 24, top: y - 11 }]}
              >
                {rowLabel(r)}
              </Text>
            ))}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { transform: cheer ? [{ translateY: hopY }] : [] }]}
          >
            {layout.cells.slice(0, shown).map((cell, i) => {
              const base = s.ask === 'turn' ? turned(cell.at, layout.center, turn) : cell.at;
              const p = {
                x: base.x + (cell.apart.x - cell.at.x) * apart,
                y: base.y + (cell.apart.y - cell.at.y) * apart,
              };
              return (
                <View
                  key={i}
                  testID="arrays-thing"
                  style={[
                    styles.cell,
                    {
                      left: p.x - c / 2,
                      top: p.y - c / 2,
                      width: c,
                      height: c,
                      opacity: counted >= 0 && cell.row >= counted ? 0.35 : 1,
                      backgroundColor:
                        s.ask === 'split' && apart > 0 ? PART_BG[cell.part] : undefined,
                    },
                  ]}
                >
                  <Thing
                    scene={s}
                    size={c * 0.92}
                    part={s.ask === 'split' && apart > 0 ? cell.part : 0}
                  />
                </View>
              );
            })}
          </Animated.View>
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, margin: 8, overflow: 'hidden' },
  world: { position: 'absolute', width: STAGE_W, height: STAGE_H },
  backdrop: { ...StyleSheet.absoluteFill, borderRadius: 16, backgroundColor: colors.surface },
  cell: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  fact: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 8,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 20,
    color: colors.ink,
  },
  factDone: { color: colors.goodInk },
  rowLabel: {
    position: 'absolute',
    width: 48,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 15,
    color: colors.softInk,
  },
  part: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 14,
  },
});
