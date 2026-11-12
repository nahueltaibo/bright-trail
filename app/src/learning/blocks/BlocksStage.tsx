import { blocksAnswer, type BlocksScene, type Place } from '@bright-trail/shared';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect as SvgRect } from 'react-native-svg';
import { font } from '../../design/tokens';
import { Text } from '../../design/Text';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { frames, wait } from '../minigames/motion';
import { colors } from '../theme';
import {
  layoutMat,
  sceneFrame,
  STAGE_H,
  STAGE_W,
  tenParts,
  type Mat,
  type MatFrame,
  type Rect,
} from './layout';
import { placeCount } from './words';

const FILL: Record<Place, readonly [string, string]> = {
  hundreds: ['#4FA3E0', '#2F7DB8'],
  tens: ['#FF7043', '#D9542B'],
  ones: ['#FFCA28', '#C99A00'],
};
const UP = { ones: 'tens', tens: 'hundreds' } as const;
const DOWN = { hundreds: 'tens', tens: 'ones' } as const;
const HEADER_Y = 14;
const COUNTER_Y = 54;
/** Trade notes and the answer shout sit under the mat, replacing each other. */
const NOTE_Y = STAGE_H - 26;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const mix = (a: Rect, b: Rect, k: number): Rect => ({
  x: a.x + (b.x - a.x) * k,
  y: a.y + (b.y - a.y) * k,
  w: a.w + (b.w - a.w) * k,
  h: a.h + (b.h - a.h) * k,
});

type Piece = { id: number; place: Place; r: Rect };

export type BlocksStageHandle = {
  /** Trades, breaks, and counts the blocks, then shows what the ask comes to. */
  play(): Promise<void>;
  /** Back to the blocks as the scene lays them out. */
  reset(): Promise<void>;
};

type Props = { scene: BlocksScene; cheer?: boolean; handle?: Ref<BlocksStageHandle> };

/** Each piece of `m` at its slot, given ids in place order. */
function piecesOf(m: Mat, frame: MatFrame, next: () => number): Piece[] {
  const { slots } = layoutMat(m, frame);
  return frame.places.flatMap((place) => slots[place].map((r) => ({ id: next(), place, r })));
}

/** Where each piece goes on `m`, matching pieces to slots in place order. */
function targetsOf(pieces: readonly Piece[], m: Mat, frame: MatFrame): Map<number, Rect> {
  const { slots } = layoutMat(m, frame);
  const seen: Record<Place, number> = { hundreds: 0, tens: 0, ones: 0 };
  return new Map(pieces.map((p) => [p.id, slots[p.place][seen[p.place]++]]));
}

/** What the answer shout says. */
function shout(s: BlocksScene): string {
  const n = blocksAnswer(s);
  return s.ask === 'count' || s.ask === 'make' ? placeCount(n, s.place!) : String(n);
}

/** Flats, rods, and cubes on a place-value mat for a blocks scene. Driven through `handle`. */
export function BlocksStage({ scene: s, cheer, handle }: Props) {
  const { plan, frame } = useMemo(() => sceneFrame(s), [s]);
  // The first mat numbers its pieces from 0. Later pieces take ids from here.
  const ids = useRef(1000);
  const next = () => ids.current++;
  const zones = useMemo(() => layoutMat(s, frame).zones, [s, frame]);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [pieces, setPieces] = useState<Piece[]>(() => {
    let n = 0;
    return piecesOf(s, frame, () => n++);
  });
  const [focus, setFocus] = useState<Place | null>(null);
  const [counted, setCounted] = useState<ReadonlySet<number>>(new Set());
  const [counters, setCounters] = useState<Partial<Record<Place, Bubble>>>({});
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [hop] = useState(() => new Animated.Value(0));
  const current = useRef(pieces);
  const run = useRef(0);

  const show = (p: Piece[]) => {
    current.current = p;
    setPieces(p);
  };

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
    const tween = (to: Map<number, Rect>, ms: number, t: number) => {
      const from = current.current;
      return frames(
        ms,
        (k) => {
          if (!live(t)) return;
          const e = ease(k);
          show(from.map((p) => ({ ...p, r: mix(p.r, to.get(p.id) ?? p.r, e) })));
        },
        () => live(t),
      );
    };
    const note = (text: string) => setBubbles([{ id: next(), x: STAGE_W / 2, y: NOTE_Y, text }]);

    return {
      async play() {
        const t = run.current;
        const counts = plan.filter((p) => p.kind === 'count');
        const many = counts.reduce((sum, p) => sum + p.mat[p.place], 0);
        const ms = Math.min(380, Math.max(110, 2600 / Math.max(1, many)));
        for (const step of plan) {
          if (!live(t)) return;
          const now = current.current;
          if (step.kind === 'trade') {
            const big = UP[step.place];
            const merging = now.filter((p) => p.place === step.place).slice(-10);
            const keep = now.filter((p) => !merging.includes(p));
            const made: Piece = { id: next(), place: big, r: { x: 0, y: 0, w: 0, h: 0 } };
            const to = targetsOf([...keep, made], step.mat, frame);
            const parts = tenParts(to.get(made.id)!, big);
            merging.forEach((p, j) => to.set(p.id, parts[j]));
            note(`10 ${step.place} make ${placeCount(1, big)}`);
            await tween(to, 700, t);
            if (!live(t)) return;
            show([
              ...keep.map((p) => ({ ...p, r: to.get(p.id)! })),
              { ...made, r: to.get(made.id)! },
            ]);
            await wait(250);
          } else if (step.kind === 'break') {
            const small = DOWN[step.place];
            const big = now.filter((p) => p.place === step.place).at(-1)!;
            const parts = tenParts(big.r, step.place).map((r) => ({ id: next(), place: small, r }));
            note(`${placeCount(1, step.place)} makes 10 ${small}`);
            show([...now.filter((p) => p !== big), ...parts]);
            await wait(200);
            await tween(targetsOf(current.current, step.mat, frame), 600, t);
            await wait(150);
          } else {
            setFocus(step.place);
            const zone = zones.find((z) => z.place === step.place)!;
            const these = now.filter((p) => p.place === step.place);
            for (let k = 0; k < these.length; k++) {
              if (!live(t)) return;
              const id = these[k].id;
              setCounted((c) => new Set(c).add(id));
              const text = String(step.from + step.by * (k + 1));
              setCounters((c) => ({
                ...c,
                [step.place]: { id: next(), x: zone.x, y: COUNTER_Y, text },
              }));
              await wait(ms);
            }
            await wait(200);
          }
        }
        if (!live(t)) return;
        if (s.ask === 'total') setFocus(null);
        setBubbles([{ id: next(), x: STAGE_W / 2, y: NOTE_Y, text: shout(s), big: true }]);
        await wait(900);
      },
      async reset() {
        run.current += 1;
        show(piecesOf(s, frame, next));
        setFocus(null);
        setCounted(new Set());
        setCounters({});
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
  const opacity = (p: Piece) =>
    focus === null || (p.place === focus && counted.has(p.id)) ? 1 : 0.35;

  return (
    <View style={styles.stage} onLayout={onLayout} testID="blocks-stage">
      {box && scale > 0 && (
        <View
          style={[
            styles.world,
            { left: (box.w - STAGE_W) / 2, top: (box.h - STAGE_H) / 2, transform: [{ scale }] },
          ]}
        >
          <View style={styles.backdrop} />
          {zones.map((z) => (
            <Text key={z.place} style={[styles.header, { left: z.x - 40, top: HEADER_Y }]}>
              {z.place}
            </Text>
          ))}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: cheer ? [{ translateY: hopY }] : [] }]}
            pointerEvents="none"
          >
            {pieces.map((p) => (
              <BlockArt key={p.id} piece={p} opacity={opacity(p)} />
            ))}
          </Animated.View>
          {Object.values(counters).map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
        </View>
      )}
    </View>
  );
}

/** One flat, rod, or cube, with the lines that show its ones. */
function BlockArt({ piece: p, opacity }: { piece: Piece; opacity: number }) {
  const { r } = p;
  const [fill, rim] = FILL[p.place];
  const cols = p.place === 'hundreds' ? 10 : 1;
  const rows = p.place === 'ones' ? 1 : 10;
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let i = 1; i < cols; i++) {
    const x = (i * r.w) / cols;
    lines.push({ x1: x, y1: 0, x2: x, y2: r.h });
  }
  for (let j = 1; j < rows; j++) {
    const y = (j * r.h) / rows;
    lines.push({ x1: 0, y1: y, x2: r.w, y2: y });
  }
  return (
    <View
      testID={`blocks-${p.place}`}
      style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h, opacity }}
    >
      <Svg width={r.w} height={r.h}>
        <SvgRect x={0} y={0} width={r.w} height={r.h} rx={1.5} fill={fill} />
        {lines.map((l, i) => (
          <Line key={i} {...l} stroke={rim} strokeWidth={0.8} opacity={0.7} />
        ))}
        <SvgRect
          x={0.75}
          y={0.75}
          width={Math.max(0, r.w - 1.5)}
          height={Math.max(0, r.h - 1.5)}
          rx={1.5}
          fill="none"
          stroke={rim}
          strokeWidth={1.5}
        />
      </Svg>
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
  header: {
    position: 'absolute',
    width: 80,
    textAlign: 'center',
    ...font.display(700),
    fontSize: 14,
    color: colors.softInk,
  },
});
