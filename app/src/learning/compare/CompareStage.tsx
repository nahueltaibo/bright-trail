import { compareRelation, type CompareScene } from '@bright-trail/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { font, radius } from '../../design/tokens';
import { Text } from '../../design/Text';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { frames, wait } from '../minigames/motion';
import { colors } from '../theme';
import { closerDistances } from './words';
import { layoutOf, STAGE_H, STAGE_W, type CompareLayout } from './layout';

/** Cubes come in fives of one colour, so a tower reads like a rekenrek. */
const CUBES = [
  ['#FF7043', '#D9542B'],
  ['#4FA3E0', '#2F7DB8'],
] as const;
const BAR = '#4FA3E0';
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export type CompareStageHandle = {
  /** Builds the towers or drops the flags, then shows the one the scene picks. */
  play(): Promise<void>;
  /** Back to the numbers alone. */
  reset(): Promise<void>;
};

type Props = { scene: CompareScene; cheer?: boolean; handle?: Ref<CompareStageHandle> };

/** What the winner hears on the stage once the play-out reaches it. */
function shout(s: CompareScene, layout: CompareLayout): string {
  const two = s.values.length === 2;
  if (s.ask === 'middle') return 'In the middle!';
  if (s.ask === 'closer') return 'Closer!';
  if (s.ask === 'relation') {
    const r = compareRelation(s);
    return r === 'same'
      ? 'Same!'
      : r === 'less'
        ? 'Less!'
        : layout.view === 'towers'
          ? 'More!'
          : 'Greater!';
  }
  const most = s.ask === 'greatest';
  if (layout.view === 'towers') {
    return most ? (two ? 'Taller!' : 'Tallest!') : two ? 'Shorter!' : 'Shortest!';
  }
  return `${two ? 'Farther' : 'Farthest'} ${most ? 'right' : 'left'}!`;
}

/** Cube towers or flags on a number line for a compare scene. Driven through `handle`. */
export function CompareStage({ scene: s, cheer, handle }: Props) {
  const layout = useMemo(() => layoutOf(s), [s]);
  const closer = s.ask === 'closer';
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [built, setBuilt] = useState(0);
  const [drop, setDrop] = useState<number[]>(() => s.values.map(() => (closer ? 1 : 0)));
  const [measure, setMeasure] = useState(0);
  const [done, setDone] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [hop] = useState(() => new Animated.Value(0));
  const run = useRef(0);
  const ids = useRef(0);

  const bubble = (x: number, y: number, text: string, big = false) =>
    setBubbles((b) => [...b, { id: ids.current++, x, y, text, big }]);

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

  /** The point above the winner where its shout pops up. */
  const winnerTop = (): { x: number; y: number } => {
    if (layout.view === 'towers') {
      const t = layout.towers[layout.winner];
      return { x: t.x, y: Math.max(20, layout.base - t.value * layout.cube - 52) };
    }
    const f = layout.flags[layout.winner];
    // A relation's other flag can stand right above the first, as for 6.3 and 6.30.
    const height = s.ask === 'relation' ? Math.max(...layout.flags.map((g) => g.height)) : f.height;
    return { x: f.x, y: Math.max(20, layout.y - height - 56) };
  };

  useImperativeHandle(handle, () => {
    const live = (t: number) => run.current === t;
    return {
      async play() {
        const t = run.current;
        if (layout.view === 'towers') {
          const most = Math.max(...layout.towers.map((x) => x.value));
          const ms = Math.min(260, Math.max(80, 1800 / most));
          for (let k = 1; k <= most; k++) {
            if (!live(t)) return;
            setBuilt(k);
            await wait(ms);
          }
        } else if (closer) {
          await frames(
            900,
            (k) => live(t) && setMeasure(ease(k)),
            () => live(t),
          );
        } else {
          for (let i = 0; i < s.values.length; i++) {
            await frames(
              560,
              (k) => live(t) && setDrop((d) => d.map((v, j) => (j === i ? ease(k) : v))),
              () => live(t),
            );
            await wait(160);
          }
        }
        if (!live(t)) return;
        await wait(250);
        if (!live(t)) return;
        setDone(true);
        const top = winnerTop();
        // The shout is up to ~170 wide, so keep its center that far from the stage's sides.
        bubble(Math.min(STAGE_W - 90, Math.max(90, top.x)), top.y, shout(s, layout), true);
        await wait(900);
      },
      async reset() {
        run.current += 1;
        setBuilt(0);
        setDrop(s.values.map(() => (closer ? 1 : 0)));
        setMeasure(0);
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
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  // A relation weighs both values, so neither fades.
  const fade = (i: number) => (done && i !== layout.winner && s.ask !== 'relation' ? 0.4 : 1);
  const lift = (i: number) => (cheer && i === layout.winner ? [{ translateY: hopY }] : []);

  return (
    <View style={styles.stage} onLayout={onLayout} testID="compare-stage">
      {box && scale > 0 && (
        <View
          style={[
            styles.world,
            { left: (box.w - STAGE_W) / 2, top: (box.h - STAGE_H) / 2, transform: [{ scale }] },
          ]}
        >
          <View style={styles.backdrop} />
          {layout.view === 'towers' ? (
            <>
              <Svg width={STAGE_W} height={STAGE_H} style={StyleSheet.absoluteFill}>
                <Line
                  x1={16}
                  y1={layout.base + 1}
                  x2={STAGE_W - 16}
                  y2={layout.base + 1}
                  stroke={colors.line}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              </Svg>
              {layout.towers.map((tower, i) => {
                const shown = Math.min(built, tower.value);
                const c = layout.cube;
                return (
                  <Animated.View
                    key={i}
                    testID="compare-tower"
                    style={[StyleSheet.absoluteFill, { opacity: fade(i), transform: lift(i) }]}
                    pointerEvents="none"
                  >
                    {Array.from({ length: shown }, (_, j) => {
                      const [fill, rim] = CUBES[Math.floor(j / 5) % 2];
                      return (
                        <View
                          key={j}
                          testID="compare-cube"
                          style={[
                            styles.cube,
                            {
                              left: tower.x - c / 2,
                              top: layout.base - (j + 1) * c,
                              width: c,
                              height: c,
                              backgroundColor: fill,
                              borderColor: rim,
                            },
                          ]}
                        />
                      );
                    })}
                    {shown === tower.value && (
                      <Text
                        style={[
                          styles.count,
                          { left: tower.x - 30, top: layout.base - shown * c - 24 },
                        ]}
                      >
                        {tower.value}
                      </Text>
                    )}
                    <View style={[styles.card, { left: tower.x - 34, top: layout.base + 10 }]}>
                      <Text style={styles.cardText}>{tower.label}</Text>
                    </View>
                  </Animated.View>
                );
              })}
            </>
          ) : (
            <>
              <Svg width={STAGE_W} height={STAGE_H} style={StyleSheet.absoluteFill}>
                <Line
                  x1={layout.x0 - 14}
                  y1={layout.y}
                  x2={layout.x1 + 14}
                  y2={layout.y}
                  stroke={colors.ink}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
                {layout.ticks.map((tick, i) => (
                  <Line
                    key={i}
                    x1={tick.x}
                    y1={layout.y - (tick.label ? 9 : 6)}
                    x2={tick.x}
                    y2={layout.y + (tick.label ? 9 : 6)}
                    stroke={colors.ink}
                    strokeWidth={tick.label ? 3 : 2}
                  />
                ))}
                {layout.target &&
                  layout.flags.map((f, i) => {
                    const from = layout.target!.x;
                    const to = from + (f.x - from) * measure;
                    return (
                      <Rect
                        key={i}
                        x={Math.min(from, to)}
                        y={layout.y - 26 - i * 10}
                        width={Math.abs(to - from)}
                        height={6}
                        rx={3}
                        fill={BAR}
                        opacity={done && i !== layout.winner ? 0.4 : 0.9}
                      />
                    );
                  })}
                {layout.flags.map((f, i) =>
                  drop[i] >= 1 ? (
                    <Line
                      key={`pole-${i}`}
                      x1={f.x}
                      y1={layout.y}
                      x2={f.x}
                      y2={layout.y - f.height}
                      stroke={colors.ink}
                      strokeWidth={2.5}
                      opacity={fade(i)}
                    />
                  ) : null,
                )}
              </Svg>
              {layout.ticks.map((tick, i) =>
                tick.label ? (
                  <Text key={i} style={[styles.tick, { left: tick.x - 30, top: layout.y + 12 }]}>
                    {tick.label}
                  </Text>
                ) : null,
              )}
              {layout.target && (
                <>
                  <Text style={[styles.frog, { left: layout.target.x - 20, top: layout.y - 40 }]}>
                    🐸
                  </Text>
                  <Text style={[styles.target, { left: layout.target.x - 30, top: layout.y + 32 }]}>
                    {layout.target.label}
                  </Text>
                </>
              )}
              {layout.target &&
                measure >= 1 &&
                layout.flags.map((f, i) => (
                  <Text
                    key={`far-${i}`}
                    style={[
                      styles.far,
                      {
                        left: (f.x + layout.target!.x) / 2 - 30,
                        top: layout.y - 50 - i * 10,
                      },
                    ]}
                  >
                    {closerDistances(s)[i]}
                  </Text>
                ))}
              {layout.flags.map((f, i) => {
                const k = drop[i];
                const to = { x: f.x, y: layout.y - f.height };
                const x = f.card.x + (to.x - f.card.x) * k;
                const y = f.card.y + (to.y - f.card.y) * k - Math.sin(k * Math.PI) * 30;
                const win = done && i === layout.winner;
                return (
                  <Animated.View
                    key={i}
                    testID="compare-flag"
                    pointerEvents="none"
                    style={[
                      styles.card,
                      win && styles.winCard,
                      { left: x - 34, top: y - 30, opacity: fade(i), transform: lift(i) },
                    ]}
                  >
                    <Text style={styles.cardText}>{f.label}</Text>
                  </Animated.View>
                );
              })}
            </>
          )}
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
  backdrop: {
    ...StyleSheet.absoluteFill,
    borderRadius: 16,
    backgroundColor: colors.surface,
  },
  cube: { position: 'absolute', borderWidth: 2, borderRadius: 3 },
  count: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 16,
    color: colors.ink,
  },
  card: {
    position: 'absolute',
    width: 68,
    height: 30,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: colors.line,
    backgroundColor: colors.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  winCard: { backgroundColor: colors.good, borderColor: colors.goodInk },
  cardText: { ...font.display(800), fontSize: 17, color: colors.ink },
  tick: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    ...font.display(700),
    fontSize: 14,
    color: colors.softInk,
  },
  frog: { position: 'absolute', width: 40, textAlign: 'center', fontSize: 28, lineHeight: 34 },
  target: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 16,
    color: colors.ink,
  },
  far: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 14,
    color: BAR,
  },
});
