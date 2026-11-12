import type { StonesScene } from '@bright-trail/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Ellipse, Path, Rect } from 'react-native-svg';
import { font } from '../../design/tokens';
import { Text } from '../../design/Text';
import { ARC, ARC_TEXT, arcPath, FROG, type Arc } from '../hopArc';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { frames, wait } from '../minigames/motion';
import { colors } from '../theme';
import { BANK_X, layoutOf, STAGE_H, STAGE_W, WATER_Y } from './layout';

const GRASS = '#CFEAB4';
const WATER = '#BFE6F5';
const WATER_EDGE = '#9CD3EA';
const STONE = '#C9C2B6';
const STONE_RIM = '#8F887C';
const STONE_TOP = '#E2DDD3';
const FROG_SIZE = 34;
/** The frog's feet sit this far above the water line, on top of a stone. */
const FEET_Y = WATER_Y - 6;
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

export type StonesStageHandle = {
  /** Hops the frog stone by stone, raising the missing stone when it gets there. */
  play(): Promise<void>;
  /** Back to the frog on the bank and the missing stone under water. */
  reset(): Promise<void>;
};

type Props = { scene: StonesScene; cheer?: boolean; handle?: Ref<StonesStageHandle> };
type Frog = { x: number; lift: number; turn: number };
type HopLabel = { id: number; x: number; y: number; text: string };

/** A pond with a row of numbered stones and one missing. Driven through `handle`. */
export function StonesStage({ scene, cheer, handle }: Props) {
  const layout = useMemo(() => layoutOf(scene), [scene]);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [frog, setFrog] = useState<Frog>({ x: BANK_X, lift: 0, turn: 0 });
  const [risen, setRisen] = useState(0);
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [labels, setLabels] = useState<HopLabel[]>([]);
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
        let x = BANK_X;
        for (const [i, stone] of layout.stones.entries()) {
          const dist = stone.x - x;
          const h = Math.min(52, 16 + dist * 0.4);
          const arc: Arc = { id: ids.current++, x0: x, x1: stone.x, top: FEET_Y - 14 - h, k: 0 };
          const from = x;
          if (i > 0) setArcs((all) => [...all, arc]);
          await frames(
            Math.min(560, 280 + dist * 2.4),
            (k) => {
              if (!live(t)) return;
              const e = ease(k);
              setFrog({
                x: from + dist * e,
                lift: 4 * h * e * (1 - e),
                turn: Math.sin(k * Math.PI * 2) * 10,
              });
              if (i > 0) setArcs((all) => all.map((a) => (a.id === arc.id ? { ...a, k: e } : a)));
              // The missing stone comes up just before the frog lands on it.
              if (stone.missing && k > 0.4) setRisen(Math.min(1, (k - 0.4) / 0.5));
            },
            () => live(t),
          );
          if (!live(t)) return;
          if (i > 0) {
            setLabels((l) => [
              ...l,
              { id: ids.current++, x: (from + stone.x) / 2, y: arc.top - 16, text: layout.hop },
            ]);
          }
          if (stone.missing) {
            setBubbles((b) => [...b, { id: ids.current++, x: stone.x, y: 60, text: stone.label }]);
          }
          x = stone.x;
          await wait(stone.missing ? 650 : 200);
          if (!live(t)) return;
        }
        await wait(200);
        if (!live(t)) return;
        setBubbles([
          { id: ids.current++, x: STAGE_W / 2, y: 60, text: `${layout.hop} each hop!`, big: true },
        ]);
        await wait(900);
      },
      async reset() {
        run.current += 1;
        setFrog({ x: BANK_X, lift: 0, turn: 0 });
        setRisen(0);
        setArcs([]);
        setLabels([]);
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
  const cheerY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const s = layout.size;
  const labelSize = Math.min(18, Math.max(13, s * 0.36));

  return (
    <View style={styles.stage} onLayout={onLayout} testID="stones-stage">
      {box && scale > 0 && (
        <View
          style={[
            styles.world,
            { left: (box.w - STAGE_W) / 2, top: (box.h - STAGE_H) / 2, transform: [{ scale }] },
          ]}
        >
          <Svg width={STAGE_W} height={STAGE_H} style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={STAGE_W} height={STAGE_H} rx={16} fill={GRASS} />
            <Rect
              x={52}
              y={WATER_Y - 70}
              width={STAGE_W - 60}
              height={128}
              rx={52}
              fill={WATER}
              stroke={WATER_EDGE}
              strokeWidth={3}
            />
            {layout.stones.map((stone, i) => {
              const k = stone.missing ? risen : 1;
              if (stone.missing && k === 0) {
                // Ripples where the missing stone sits under the water.
                return (
                  <Ellipse
                    key={i}
                    cx={stone.x}
                    cy={WATER_Y + 4}
                    rx={s / 2}
                    ry={s / 5}
                    fill="none"
                    stroke={WATER_EDGE}
                    strokeWidth={2.5}
                    strokeDasharray={[5, 4]}
                  />
                );
              }
              const y = WATER_Y + 4 + (1 - k) * 14;
              return (
                <Path
                  key={i}
                  testID="stones-stone"
                  d={stonePath(stone.x, y, s)}
                  fill={STONE}
                  stroke={STONE_RIM}
                  strokeWidth={2.5}
                  opacity={k}
                />
              );
            })}
            {layout.stones.map((stone, i) =>
              stone.missing && risen === 0 ? null : (
                <Ellipse
                  key={`top-${i}`}
                  cx={stone.x}
                  cy={WATER_Y - 2 + (stone.missing ? (1 - risen) * 14 : 0)}
                  rx={s * 0.36}
                  ry={s * 0.1}
                  fill={STONE_TOP}
                  opacity={stone.missing ? risen : 1}
                />
              ),
            )}
            {arcs.map((a) => (
              <Path
                key={a.id}
                d={arcPath(a, FEET_Y + 10)}
                fill="none"
                stroke={ARC}
                strokeWidth={2.5}
                strokeDasharray={[6, 5]}
                strokeLinecap="round"
              />
            ))}
          </Svg>
          {layout.stones.map((stone, i) => {
            const shown = !stone.missing || risen >= 1;
            return (
              <Text
                key={i}
                testID={stone.missing ? 'stones-missing' : undefined}
                style={[
                  styles.number,
                  { left: stone.x - 30, top: WATER_Y + 16, fontSize: labelSize },
                  stone.missing && styles.found,
                  stone.missing && !shown && styles.unknown,
                ]}
              >
                {shown ? stone.label : '?'}
              </Text>
            );
          })}
          {labels.map((l) => (
            <Text key={l.id} style={[styles.hop, { left: l.x - 30, top: l.y - 10 }]}>
              {l.text}
            </Text>
          ))}
          <Animated.Text
            testID="stones-frog"
            style={[
              styles.frog,
              {
                left: frog.x - FROG_SIZE / 2,
                top: FEET_Y - FROG_SIZE - frog.lift,
                transform: [
                  { rotate: `${frog.turn}deg` },
                  ...(cheer ? [{ translateY: cheerY }] : []),
                ],
              },
            ]}
          >
            {FROG}
          </Animated.Text>
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
        </View>
      )}
    </View>
  );
}

/** A flat, rounded stone with its waterline at `y`. */
function stonePath(x: number, y: number, size: number): string {
  const w = size / 2;
  const h = size * 0.32;
  return [
    `M ${x - w} ${y}`,
    `Q ${x - w} ${y - h} ${x} ${y - h}`,
    `Q ${x + w} ${y - h} ${x + w} ${y}`,
    `Q ${x} ${y + h * 0.45} ${x - w} ${y}`,
    'Z',
  ].join(' ');
}

const styles = StyleSheet.create({
  stage: { flex: 1, margin: 8, overflow: 'hidden' },
  world: { position: 'absolute', width: STAGE_W, height: STAGE_H },
  number: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    ...font.display(800),
    color: colors.ink,
  },
  found: { color: colors.goodInk },
  unknown: { color: colors.softInk },
  hop: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    ...font.display(800),
    fontSize: 14,
    color: ARC_TEXT,
  },
  frog: {
    position: 'absolute',
    width: FROG_SIZE,
    textAlign: 'center',
    fontSize: 28,
    lineHeight: FROG_SIZE,
  },
});
