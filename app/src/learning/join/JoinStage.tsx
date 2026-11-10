import { type JoinMove, type JoinScene } from '@bright-trail/shared';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Animated, Platform, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { frames, wait } from '../minigames/motion';
import { BoardArt } from './BoardArt';
import { boardOf, STAGE_H, STAGE_W, type Board, type Pt } from './board';
import { joinWords } from './words';
import { font } from '../../design/tokens';
import { Text } from '../../design/Text';

const NATIVE = Platform.OS !== 'web';
const COUNT_MS = 320;
const COUNTERS = { first: ['#FF7043', '#D9542B'], second: ['#FFC23D', '#D99A1C'] } as const;
/** Where bites land, as a share of the thing's size from its center. */
const BITES = [
  [0.42, -0.28],
  [0.46, 0.14],
  [0.12, -0.44],
  [0.16, 0.02],
  [-0.18, -0.3],
  [-0.1, 0.32],
] as const;
const CRUMB = '#B57B3E';

export type JoinStageHandle = {
  /** Plays the story: things come, go, or move aside, then get counted. */
  play(): Promise<void>;
  /** Puts everything back where the story starts. */
  reset(): Promise<void>;
};

type Thing = { id: number; second: boolean; bites: number };
type ThingAnim = {
  x: Animated.Value;
  y: Animated.Value;
  r: Animated.Value;
  s: Animated.Value;
  o: Animated.Value;
};
type Pos = { x: number; y: number; r: number; s: number };
type Burst = { id: number; x: number; y: number; k: Animated.Value };
type Crumb = { id: number; x: number; y: number; r: number };
type Ring = { id: number; x: number; y: number };
type Style = JoinMove;

const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

/** How long a move takes and where it is at 0..1. Every path ends exactly at `to`. */
function pathOf(style: Style, from: Pt, to: Pt): { ms: number; at: (k: number) => Pos } {
  const dist = Math.hypot(to.x - from.x, to.y - from.y);
  const line = (e: number) => ({ x: lerp(from.x, to.x, e), y: lerp(from.y, to.y, e) });
  switch (style) {
    case 'hop': {
      const hops = Math.max(1, Math.round(dist / 60));
      return {
        ms: 260 * hops,
        at: (k) => {
          const lift = Math.abs(Math.sin(k * Math.PI * hops));
          const p = line(k);
          return { x: p.x, y: p.y - 34 * lift, r: 0, s: 1 + 0.08 * lift };
        },
      };
    }
    case 'fly':
      return {
        ms: 900,
        at: (k) => {
          const p = line(ease(k));
          const fade = 1 - k;
          return {
            x: p.x + Math.sin(k * Math.PI * 3) * 8 * fade,
            y: p.y + Math.sin(k * Math.PI * 4) * 6 * fade,
            r: Math.sin(k * Math.PI * 10) * 10 * fade,
            s: 1,
          };
        },
      };
    case 'float':
      return {
        ms: 1300,
        at: (k) => {
          const p = line(k);
          const fade = 1 - k;
          return {
            x: p.x + Math.sin(k * Math.PI * 3) * 10 * fade,
            y: p.y,
            r: Math.sin(k * Math.PI * 2) * 6 * fade,
            s: 1,
          };
        },
      };
    case 'swim':
      return {
        ms: Math.max(600, dist * 4),
        at: (k) => {
          const p = line(ease(k));
          return {
            x: p.x,
            y: p.y + Math.sin(k * Math.PI * 3) * 5,
            r: Math.sin(k * Math.PI * 6) * 6 * (1 - k),
            s: 1,
          };
        },
      };
    case 'walk': {
      const steps = Math.max(2, Math.round(dist / 18));
      return {
        ms: Math.max(400, dist * 5),
        at: (k) => {
          const p = line(k);
          const step = Math.sin(k * Math.PI * steps);
          return { x: p.x, y: p.y - Math.abs(step) * 4, r: step * 4, s: 1 };
        },
      };
    }
    case 'drive':
      return {
        ms: Math.max(500, dist * 3.5),
        at: (k) => {
          const p = line(ease(k));
          return { x: p.x, y: p.y - Math.abs(Math.sin(k * Math.PI * 8)) * 1.5, r: 0, s: 1 };
        },
      };
    case 'slide':
      return {
        ms: 520,
        at: (k) => {
          const p = line(ease(k));
          return { x: p.x, y: p.y - Math.sin(k * Math.PI) * 18, r: 0, s: 1 };
        },
      };
  }
}

/** How things get from a pile or into a part's aside spot: a short trip, not a long journey. */
const shortMove = (move: JoinMove): Style =>
  move === 'hop' ? 'hop' : move === 'fly' || move === 'float' ? 'fly' : 'slide';

type Props = { scene: JoinScene; cheer?: boolean; handle?: Ref<JoinStageHandle> };

/** A join-and-leave story on a ten-frame. Driven through `handle`. */
export function JoinStage({ scene: s, cheer, handle }: Props) {
  const [board] = useState<Board>(() => boardOf(s));
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [things, setThings] = useState<Thing[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [bursts, setBursts] = useState<Burst[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [rings, setRings] = useState<Ring[]>([]);
  const [hop] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  // Animated values per thing, made on first use. Kept in state so render can read them.
  const [anims] = useState(() => new Map<number, ThingAnim>());

  const pos = useRef(new Map<number, Pos>());
  /** Which spot each thing sits in. Things off the frame aren't here. */
  const spots = useRef(new Map<number, number>());
  const thingsRef = useRef<Thing[]>([]);
  const run = useRef(0);
  const ids = useRef(0);
  const words = joinWords(s);

  const anim = (id: number): ThingAnim => {
    let a = anims.get(id);
    if (!a) {
      a = {
        x: new Animated.Value(0),
        y: new Animated.Value(0),
        r: new Animated.Value(0),
        s: new Animated.Value(1),
        o: new Animated.Value(1),
      };
      anims.set(id, a);
    }
    return a;
  };
  const put = (id: number, p: Pos) => {
    pos.current.set(id, p);
    const a = anim(id);
    a.x.setValue(p.x);
    a.y.setValue(p.y);
    a.r.setValue(p.r);
    a.s.setValue(p.s);
  };
  const add = (at: Pt, second = false): number => {
    const id = ids.current++;
    put(id, { ...at, r: 0, s: 1 });
    anim(id).o.setValue(1);
    thingsRef.current = [...thingsRef.current, { id, second, bites: 0 }];
    setThings(thingsRef.current);
    return id;
  };
  const bubble = (at: Pt, text: string, big = false) =>
    setBubbles((b) => [...b, { id: ids.current++, x: at.x, y: at.y, text, big }]);
  const above = (id: number): Pt => {
    const p = pos.current.get(id)!;
    return { x: p.x, y: p.y - board.size * 0.62 };
  };

  const setup = () => {
    thingsRef.current = [];
    spots.current.clear();
    pos.current.clear();
    setBubbles([]);
    setBursts([]);
    setCrumbs([]);
    setRings([]);
    // Counters on a ten-frame picture are counted where they are. Things are counted from a pile.
    const fromPile = s.ask === 'count' && s.emoji !== undefined;
    for (let i = 0; i < s.start; i++) {
      const id = add(fromPile ? board.pile[i] : board.cells[i]);
      if (!fromPile) spots.current.set(id, i);
    }
    if (s.ask === 'make-ten') {
      for (let i = 0; i < s.more!; i++) spots.current.set(add(board.cells[10 + i], true), 10 + i);
    }
    setThings(thingsRef.current);
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!box) {
      run.current += 1;
      setup();
    }
    setBox({ w: width, h: height });
  };

  useEffect(() => {
    const runs = run;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 550, useNativeDriver: NATIVE }),
        Animated.timing(pulse, { toValue: 0, duration: 550, useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => {
      runs.current += 1;
      loop.stop();
    };
  }, [pulse]);

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

  useImperativeHandle(handle, () => {
    const live = (t: number) => run.current === t;

    const moveTo = (t: number, id: number, to: Pt, style: Style, ms?: number) => {
      const from = pos.current.get(id)!;
      const path = pathOf(style, from, to);
      return frames(ms ?? path.ms, (k) => {
        if (live(t)) put(id, path.at(k));
      });
    };

    /** A new thing comes in from off the stage to spot `cell`, the way it moves. */
    const come = async (t: number, cell: number) => {
      const to = board.cells[cell];
      let id: number;
      if (board.place === 'bus') {
        id = add({ x: STAGE_W + 40, y: board.ground });
        await moveTo(t, id, { x: to.x, y: board.ground }, 'walk');
        await moveTo(t, id, to, 'hop', 360);
      } else if (s.move === 'fly') {
        id = add({ x: STAGE_W + 30, y: -30 });
        await moveTo(t, id, to, 'fly');
      } else if (s.move === 'float') {
        id = add({ x: to.x + 30, y: STAGE_H + 40 });
        await moveTo(t, id, to, 'float');
      } else {
        id = add({ x: STAGE_W + 40, y: to.y });
        await moveTo(t, id, to, s.move);
      }
      spots.current.set(id, cell);
      return id;
    };

    const pop = async (t: number, id: number) => {
      const p = pos.current.get(id)!;
      await frames(260, (k) => {
        if (live(t)) put(id, { ...p, s: 1 + 0.35 * k, r: Math.sin(k * Math.PI * 6) * 4 });
      });
      if (!live(t)) return;
      anim(id).o.setValue(0);
      const burst = { id: ids.current++, x: p.x, y: p.y, k: new Animated.Value(0) };
      setBursts((b) => [...b, burst]);
      await new Promise<void>((r) =>
        Animated.timing(burst.k, { toValue: 1, duration: 380, useNativeDriver: NATIVE }).start(() =>
          r(),
        ),
      );
      setBursts((b) => b.filter((x) => x.id !== burst.id));
    };

    const eat = async (t: number, id: number) => {
      const p = pos.current.get(id)!;
      for (let n = 1; n <= BITES.length; n++) {
        if (!live(t)) return;
        thingsRef.current = thingsRef.current.map((x) => (x.id === id ? { ...x, bites: n } : x));
        setThings(thingsRef.current);
        const [bx] = BITES[n - 1];
        setCrumbs((c) => [
          ...c,
          ...[0, 1].map((j) => ({
            id: ids.current++,
            x: p.x + (bx + (j - 0.5) * 0.3) * board.size,
            y: p.y + board.size * (0.34 + 0.08 * j),
            r: 1.6 + j,
          })),
        ]);
        await wait(240);
      }
      const a = anim(id);
      await frames(200, (k) => {
        if (!live(t)) return;
        a.o.setValue(1 - k);
        a.s.setValue(1 - 0.3 * k);
      });
    };

    /** A thing leaves the way the story says: off the stage, popped, or eaten in its spot. */
    const leave = async (t: number, id: number) => {
      spots.current.delete(id);
      const style = s.leave ?? s.move;
      if (style === 'pop') return pop(t, id);
      if (style === 'eat') return eat(t, id);
      const p = pos.current.get(id)!;
      if (board.place === 'bus') {
        await moveTo(t, id, { x: p.x, y: board.ground }, 'hop', 360);
        await moveTo(t, id, { x: STAGE_W + 40, y: board.ground }, 'walk');
      } else if (style === 'fly' || style === 'float') {
        await moveTo(t, id, { x: p.x + 200, y: -50 }, style);
      } else {
        await moveTo(t, id, { x: STAGE_W + 40, y: p.y }, style);
      }
      if (live(t)) anim(id).o.setValue(0);
    };

    /** Things in the frame, in spot order. */
    const inFrame = () =>
      [...spots.current.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id);

    const countUp = async (t: number, list: number[], from = 1) => {
      for (let i = 0; i < list.length; i++) {
        if (!live(t)) return;
        bubble(above(list[i]), `${from + i}`);
        await wait(COUNT_MS);
      }
    };
    const clear = () => {
      setBubbles([]);
      setRings([]);
    };
    const sum = (text: string) =>
      bubble(s.ask === 'part' ? { x: 180, y: 22 } : board.sum, text, true);
    const startText = () => {
      if (s.start > 0) bubble({ x: 180, y: 22 }, `${s.start} ${s.start === 1 ? s.one : s.many}`);
    };

    const plays: Record<JoinScene['ask'], (t: number) => Promise<void>> = {
      async count(t) {
        const all = thingsRef.current.map((x) => x.id);
        if (spots.current.size === 0) {
          for (let i = 0; i < all.length; i++) {
            await moveTo(t, all[i], board.cells[i], shortMove(s.move), 420);
            if (!live(t)) return;
            spots.current.set(all[i], i);
            bubble(above(all[i]), `${i + 1}`);
            await wait(80);
          }
        } else {
          await countUp(t, inFrame());
        }
        await wait(400);
        if (!live(t)) return;
        clear();
        sum(`${s.start} ${s.start === 1 ? s.one : s.many}`);
      },

      async join(t) {
        startText();
        await wait(700);
        if (!live(t)) return;
        clear();
        for (let i = s.start; i < s.start + s.more!; i++) {
          const id = await come(t, i);
          if (!live(t)) return;
          bubble(above(id), `${i + 1}`);
        }
        await wait(400);
        if (!live(t)) return;
        clear();
        sum(words.equation);
      },

      async back(t) {
        await plays.join(t);
      },

      async leave(t) {
        const going = inFrame()
          .slice(s.start - s.take!)
          .reverse();
        const together = s.leave !== 'pop' && s.leave !== 'eat';
        const trips: Promise<void>[] = [];
        for (const id of going) {
          if (!live(t)) return;
          if (together) {
            trips.push(leave(t, id));
            await wait(260);
          } else {
            await leave(t, id);
            await wait(200);
          }
        }
        await Promise.all(trips);
        if (!live(t)) return;
        await countUp(t, inFrame());
        await wait(200);
        if (!live(t)) return;
        clear();
        sum(words.equation);
      },

      async part(t) {
        const aside = inFrame().slice(s.start - s.take!);
        for (let i = 0; i < aside.length; i++) {
          const id = aside[i];
          spots.current.delete(id);
          await moveTo(t, id, board.aside[i], shortMove(s.move), 650);
          if (!live(t)) return;
          bubble(above(id), `${i + 1}`);
        }
        await wait(400);
        if (!live(t)) return;
        clear();
        const stay = inFrame();
        for (let i = 0; i < stay.length; i++) {
          const p = pos.current.get(stay[i])!;
          setRings((r) => [...r, { id: ids.current++, x: p.x, y: p.y }]);
          bubble(above(stay[i]), `${i + 1}`);
          await wait(COUNT_MS + 100);
          if (!live(t)) return;
        }
        await wait(300);
        if (!live(t)) return;
        sum(words.equation);
      },

      async fill(t) {
        for (let i = s.start; i < s.target!; i++) {
          if (!live(t)) return;
          const c = board.cells[i];
          setRings((r) => [...r, { id: ids.current++, x: c.x, y: c.y }]);
          bubble({ x: c.x, y: c.y - board.size * 0.62 }, `${i - s.start + 1}`);
          await wait(450);
        }
        await wait(300);
        if (!live(t)) return;
        clear();
        for (let i = s.start; i < s.target!; i++) {
          await come(t, i);
          if (!live(t)) return;
        }
        sum(words.equation);
      },

      async 'make-ten'(t) {
        bubble({ x: 330, y: 72 }, `${s.start}`);
        bubble({ x: 330, y: 180 }, `${s.more}`);
        await wait(800);
        if (!live(t)) return;
        clear();
        const need = 10 - s.start;
        const movers = inFrame()
          .filter((id) => spots.current.get(id)! >= 10)
          .slice(-need)
          .reverse();
        for (let i = 0; i < movers.length; i++) {
          spots.current.set(movers[i], s.start + i);
          await moveTo(t, movers[i], board.cells[s.start + i], 'hop', 650);
          if (!live(t)) return;
        }
        bubble({ x: 330, y: 72 }, '10');
        await wait(450);
        if (!live(t)) return;
        bubble({ x: 330, y: 180 }, `${s.start + s.more! - 10}`);
        await wait(800);
        if (!live(t)) return;
        clear();
        sum(words.equation);
      },
    };

    return {
      async play() {
        const t = run.current;
        await plays[s.ask](t);
      },
      async reset() {
        run.current += 1;
        setup();
        await wait(50);
      },
    };
  });

  const scale = box ? Math.min(box.w / STAGE_W, box.h / STAGE_H) : 0;
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const size = board.size;
  return (
    <View style={styles.stage} onLayout={onLayout} testID="join-stage">
      {box && scale > 0 && (
        <View
          style={[
            styles.world,
            {
              left: (box.w - STAGE_W) / 2,
              top: (box.h - STAGE_H) / 2,
              transform: [{ scale }],
            },
          ]}
        >
          <View style={styles.rounded}>
            <BoardArt board={board} />
          </View>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={STAGE_W} height={STAGE_H}>
              {crumbs.map((c) => (
                <Line
                  key={c.id}
                  x1={c.x}
                  y1={c.y}
                  x2={c.x + 0.1}
                  y2={c.y}
                  stroke={CRUMB}
                  strokeWidth={c.r * 2}
                  strokeLinecap="round"
                  opacity={0.8}
                />
              ))}
            </Svg>
          </View>
          {rings.map((r) => (
            <Animated.View
              key={r.id}
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  left: r.x - size * 0.7,
                  top: r.y - size * 0.7,
                  width: size * 1.4,
                  height: size * 1.4,
                  borderRadius: size * 0.7,
                  opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 0.45] }),
                },
              ]}
            />
          ))}
          {things.map((th) => {
            const a = anim(th.id);
            const [fill, rim] = th.second ? COUNTERS.second : COUNTERS.first;
            return (
              <Animated.View
                key={th.id}
                pointerEvents="none"
                testID="join-thing"
                style={[
                  styles.thing,
                  {
                    left: -size / 2,
                    top: -size / 2,
                    width: size,
                    height: size,
                    opacity: a.o,
                    transform: [
                      { translateX: a.x },
                      { translateY: cheer ? Animated.add(a.y, hopY) : a.y },
                      {
                        rotate: a.r.interpolate({
                          inputRange: [-360, 360],
                          outputRange: ['-360deg', '360deg'],
                        }),
                      },
                      { scale: a.s },
                    ],
                  },
                ]}
              >
                {s.emoji ? (
                  <Text style={[styles.emoji, { fontSize: size * 0.82, lineHeight: size }]}>
                    {s.emoji}
                  </Text>
                ) : (
                  <View
                    style={{
                      width: size * 0.84,
                      height: size * 0.84,
                      borderRadius: size * 0.42,
                      backgroundColor: fill,
                      borderColor: rim,
                      borderWidth: 2.5,
                    }}
                  />
                )}
                {BITES.slice(0, th.bites).map(([bx, by], k) => (
                  <View
                    key={k}
                    style={{
                      position: 'absolute',
                      left: size / 2 + bx * size - size * 0.24,
                      top: size / 2 + by * size - size * 0.24,
                      width: size * 0.48,
                      height: size * 0.48,
                      borderRadius: size * 0.24,
                      backgroundColor: board.spot,
                    }}
                  />
                ))}
              </Animated.View>
            );
          })}
          {bursts.map((b) => (
            <Animated.View
              key={b.id}
              pointerEvents="none"
              style={[
                styles.burst,
                {
                  left: b.x - 40,
                  top: b.y - 40,
                  opacity: b.k.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [
                    { scale: b.k.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.3] }) },
                  ],
                },
              ]}
            >
              <Svg width={80} height={80}>
                {Array.from({ length: 8 }, (_, i) => {
                  const ang = (i / 8) * Math.PI * 2;
                  return (
                    <Line
                      key={i}
                      x1={40 + Math.cos(ang) * 16}
                      y1={40 + Math.sin(ang) * 16}
                      x2={40 + Math.cos(ang) * 30}
                      y2={40 + Math.sin(ang) * 30}
                      stroke="#FF7043"
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  );
                })}
              </Svg>
              <Text style={styles.popWord}>pop!</Text>
            </Animated.View>
          ))}
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
  rounded: { width: STAGE_W, height: STAGE_H, borderRadius: 16, overflow: 'hidden' },
  thing: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  emoji: { textAlign: 'center', includeFontPadding: false },
  ring: { position: 'absolute', borderWidth: 4, borderColor: '#FFB347' },
  burst: {
    position: 'absolute',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  popWord: { position: 'absolute', ...font.display(800), fontSize: 16, color: '#D9542B' },
});
