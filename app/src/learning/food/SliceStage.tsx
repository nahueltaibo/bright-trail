import { sliceTotal, type SliceScene } from '@bright-trail/shared';
import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, ClipPath, Defs, Ellipse, G, Line, Mask, Path, Rect } from 'react-native-svg';
import { castFrom, type Kid } from '../minigames/cast';
import { colors } from '../theme';
import { CRUMB, edgeLook, FoodArt, PICKED_FILL, Underlay } from './FoodArt';
import { Gaps } from '../FractionPicture';
import {
  biteRows,
  outward,
  pickOffset,
  turnPoint,
  wholeOf,
  type Bite,
  type Pt,
  type Whole,
} from './geometry';
import { sliceLayout, slotOf, type SliceLayout, type WholeSpot } from './layout';

const NATIVE = Platform.OS !== 'web';
const PULL_MS = 450;
const COUNT_MS = 380;

export type StageUnit = 'count' | 'fraction';
export type SliceStageHandle = {
  /** Plays the scene's story: slices move, get eaten, cut, or shared, then get counted. */
  play(): Promise<void>;
  /** Puts everything back where the story starts. */
  reset(): Promise<void>;
};

type Model = {
  key: string;
  spot: WholeSpot;
  parts: number;
  picked: number[];
  gone: number[];
  lifted: number[];
  uncut: boolean;
  /** Keeps a group where it is when the whole is swapped for one cut differently. */
  offset?: Pt;
};
type Anim = { xy: Animated.ValueXY; s: Animated.Value; o: Animated.Value };
type Pos = { x: number; y: number; s: number };
type Bubble = { id: number; x: number; y: number; text: string; big?: boolean };
type Cut = { id: number; a: Pt; b: Pt; k: number };
type Crumb = { id: number; x: number; y: number; color: string; fall: Animated.Value };
type Bites = { rows: Bite[][]; n: number; k: number };

function timing(v: Animated.Value | Animated.ValueXY, to: number | Pt, ms: number) {
  return new Promise<void>((resolve) =>
    Animated.timing(v, {
      toValue: to,
      duration: ms,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: NATIVE,
    } as Animated.TimingAnimationConfig).start(() => resolve()),
  );
}

/** Calls `step` with 0..1 on each frame, for things Animated can't drive, like bite sizes. */
function frames(ms: number, step: (k: number) => void) {
  return new Promise<void>((resolve) => {
    const start = Date.now();
    const tick = () => {
      const k = Math.min(1, (Date.now() - start) / ms);
      step(k);
      if (k < 1) requestAnimationFrame(tick);
      else resolve();
    };
    requestAnimationFrame(tick);
  });
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fraction = (n: number, d: number) => `${n}/${d}`;

type Props = {
  scene: SliceScene;
  unit: StageUnit;
  /** Picks the kids' names and looks, so the same item always gets the same cast. */
  seed: string;
  cheer?: boolean;
  handle?: Ref<SliceStageHandle>;
};

/** A slices story on a plate or tray. Driven through `handle`. */
export function SliceStage({ scene: s, unit, seed, cheer, handle }: Props) {
  const [layout, setLayout] = useState<SliceLayout | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [models, setModels] = useState<Model[]>([]);
  const [bites, setBites] = useState<Record<string, Bites>>({});
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [cuts, setCuts] = useState<Cut[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [kids] = useState<Kid[]>(() => {
    const next = castFrom(seed, s.who ? [s.who.name] : []);
    return Array.from({ length: s.friends ?? s.parts }, next);
  });
  const [hop] = useState(() => new Animated.Value(0));

  // Animated values per slice, made on first use. Kept in state so render can read them.
  const [anims] = useState(() => new Map<string, Anim>());
  const pos = useRef(new Map<string, Pos>());
  const modelsRef = useRef<Model[]>([]);
  const run = useRef(0);
  const ids = useRef(0);

  const anim = (key: string): Anim => {
    let a = anims.get(key);
    if (!a) {
      a = {
        xy: new Animated.ValueXY({ x: 0, y: 0 }),
        s: new Animated.Value(1),
        o: new Animated.Value(1),
      };
      anims.set(key, a);
    }
    return a;
  };
  const update = (fn: (ms: Model[]) => Model[]) => {
    modelsRef.current = fn(modelsRef.current);
    setModels(modelsRef.current);
  };
  const geo = (m: Model): Whole => wholeOf(s.shape, m.parts, m.spot.w, m.spot.h, m.spot.rot);
  const offsetOf = (m: Model) => m.offset ?? pickOffset(geo(m), new Set(m.picked), new Set(m.gone));

  /** Moves slice `i` of `m` so its tip sits `to` from the whole's center, scaled by `scale`. */
  const place = (m: Model, i: number, to: Pt, scale = 1, ms = PULL_MS) => {
    const key = `${m.key}:${i}`;
    pos.current.set(key, { x: to.x, y: to.y, s: scale });
    const a = anim(key);
    if (ms === 0) {
      a.xy.setValue(to);
      a.s.setValue(scale);
      return Promise.resolve();
    }
    return Promise.all([timing(a.xy, to, ms), timing(a.s, scale, ms)]).then(() => undefined);
  };
  /** Where slice `i` of `m` is on the stage now. */
  const centerOf = (m: Model, i: number): Pt => {
    const p = pos.current.get(`${m.key}:${i}`) ?? { x: 0, y: 0, s: 1 };
    const c = geo(m).pieces[i].c;
    return { x: m.spot.x + p.x + p.s * c.x, y: m.spot.y + p.y + p.s * c.y };
  };

  /** Where the summary bubble goes, above the food. */
  const top = (): Pt => ({ x: layout?.meet.x ?? 0, y: 22 });
  const bubble = (at: Pt, text: string, big = false) =>
    setBubbles((b) => [...b, { id: ids.current++, x: at.x, y: at.y, text, big }]);

  /** Starting state: who is picked, what is already gone, whether the whole is cut yet. */
  const setup = (l: SliceLayout) => {
    const start: Model[] = l.wholes.map((spot, w) => ({
      key: `w${w}-${ids.current++}`,
      spot,
      parts: spot.parts,
      picked: [],
      gone: [],
      lifted: [],
      // A parts story with a picture already shows the cuts and its picked slices.
      uncut: s.ask === 'parts' && s.picked === undefined,
    }));
    const total = sliceTotal(s);
    const pickedAtStart =
      s.ask === 'picked' || s.ask === 'same' || s.ask === 'parts' ? (s.picked ?? 0) : 0;
    for (let g = 0; g < total; g++) {
      const { w, i } = slotOf(s, g);
      if (g < pickedAtStart) start[w].picked.push(i);
      if (g >= total - (s.eaten ?? 0)) start[w].gone.push(i);
    }
    if (s.ask === 'bigger') start.forEach((m) => m.picked.push(0));
    start.forEach((m) => (m.lifted = [...m.picked]));
    modelsRef.current = start;
    setModels(start);
    setBites({});
    setBubbles([]);
    setCuts([]);
    setCrumbs([]);
    for (const m of start) {
      const off = offsetOf(m);
      for (let i = 0; i < m.parts; i++) {
        const a = anim(`${m.key}:${i}`);
        a.o.setValue(m.gone.includes(i) ? 0 : 1);
        void place(m, i, m.picked.includes(i) ? off : { x: 0, y: 0 }, 1, 0);
      }
    }
  };

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const l = sliceLayout(s, width, height);
    setBox({ w: width, h: height });
    setLayout(l);
    run.current += 1;
    setup(l);
  };

  useEffect(() => {
    const runs = run;
    return () => {
      runs.current += 1;
    };
  }, []);

  useEffect(() => {
    if (!cheer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 220, useNativeDriver: NATIVE }),
        Animated.timing(hop, { toValue: 0, duration: 220, useNativeDriver: NATIVE }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [cheer, hop]);

  useImperativeHandle(handle, () => {
    const live = (t: number) => run.current === t;

    /** Picks `list` in whole `w`: the group slides out together, the rest slide home. */
    const pick = async (w: number, list: number[], ms = PULL_MS) => {
      update((all) =>
        all.map((m, j) => (j === w ? { ...m, picked: list, lifted: list, offset: undefined } : m)),
      );
      const m = modelsRef.current[w];
      const off = offsetOf(m);
      await Promise.all(
        Array.from({ length: m.parts }, (_, i) => i)
          .filter((i) => !m.gone.includes(i))
          .map((i) => place(m, i, list.includes(i) ? off : { x: 0, y: 0 }, 1, ms)),
      );
    };

    /** Eats a slice: it slides off along its center line, then bites take it from the tip. */
    const eat = async (t: number, w: number, i: number) => {
      const m = modelsRef.current[w];
      const g = geo(m);
      const out = outward(g, i, new Set(m.gone));
      update((all) =>
        all.map((x, j) => (j === w ? { ...x, lifted: [...x.lifted, i], gone: [...x.gone, i] } : x)),
      );
      const away = g.unit * (g.round ? 0.95 : 0.9);
      await place(m, i, { x: out.x * away, y: out.y * away }, 1, 520);
      const rows = biteRows(g, i, out);
      const key = `${m.key}:${i}`;
      const rowMs = Math.max(140, 900 / rows.length);
      for (let r = 0; r < rows.length; r++) {
        if (!live(t)) return;
        const p = pos.current.get(key)!;
        setCrumbs((c) => [
          ...c,
          ...rows[r].map((b) => ({
            id: ids.current++,
            x: m.spot.x + p.x + b.x,
            y: m.spot.y + p.y + b.y,
            color: s.food ? CRUMB[s.food] : colors.line,
            fall: new Animated.Value(0),
          })),
        ]);
        await frames(rowMs * 0.45, (k) =>
          setBites((all) => ({ ...all, [key]: { rows, n: r, k } })),
        );
        await wait(rowMs * 0.55);
      }
      await timing(anim(key).o, 0, 200);
    };

    const countSlices = async (
      t: number,
      slices: { w: number; i: number }[],
      label: (n: number) => string,
    ) => {
      for (let n = 0; n < slices.length; n++) {
        if (!live(t)) return;
        const m = modelsRef.current[slices[n].w];
        bubble(centerOf(m, slices[n].i), label(n + 1));
        await wait(COUNT_MS);
      }
    };

    const cutLine = async (t: number, a: Pt, b: Pt) => {
      const id = ids.current++;
      setCuts((c) => [...c, { id, a, b, k: 0 }]);
      await frames(380, (k) => setCuts((c) => c.map((x) => (x.id === id ? { ...x, k } : x))));
      if (!live(t)) return;
    };

    const plays: Record<SliceScene['ask'], (t: number) => Promise<void>> = {
      async picked(t) {
        const all = modelsRef.current.flatMap((m, w) => m.picked.map((i) => ({ w, i })));
        for (let n = 0; n < all.length; n++) {
          if (!live(t)) return;
          const m = modelsRef.current[all[n].w];
          bubble(centerOf(m, all[n].i), unit === 'count' ? `${n + 1}` : fraction(n + 1, s.parts));
          await wait(COUNT_MS);
          if ((n + 1) % s.parts === 0 && (s.wholes ?? 1) > 1) {
            bubble({ x: m.spot.x, y: m.spot.y + m.spot.h / 2 + 30 }, '1 whole', true);
            await wait(COUNT_MS);
          }
        }
        const p = s.picked!;
        bubble(
          top(),
          unit === 'count' ? `${p} picked` : `${p} of ${s.parts} = ${fraction(p, s.parts)}`,
          true,
        );
      },

      async left(t) {
        const total = sliceTotal(s);
        const there = Array.from({ length: total }, (_, g) => g).filter(
          (g) => g < total - (s.eaten ?? 0),
        );
        for (const g of there.slice(0, s.take)) {
          const { w, i } = slotOf(s, g);
          await eat(t, w, i);
          if (!live(t)) return;
        }
        const rest = there.slice(s.take).map((g) => slotOf(s, g));
        await countSlices(t, rest, (n) => (unit === 'count' ? `${n}` : fraction(n, s.parts)));
        const start = there.length;
        const left = rest.length;
        bubble(
          top(),
          unit === 'count'
            ? `${start} − ${s.take} = ${left}`
            : `${fraction(start, s.parts)} − ${fraction(s.take!, s.parts)} = ${fraction(left, s.parts)}`,
          true,
        );
      },

      async parts(t) {
        const m = modelsRef.current[0];
        const g = geo(m);
        const at = (p: Pt) => ({ x: m.spot.x + p.x, y: m.spot.y + p.y });
        if (!m.uncut) {
          await countSlices(
            t,
            g.pieces.map((_, i) => ({ w: 0, i })),
            (n) => `${n}`,
          );
          bubble(top(), `${s.parts} equal ${g.round ? 'slices' : 'pieces'}`, true);
          return;
        }
        if (g.round) {
          const even = s.parts % 2 === 0;
          for (let j = 0; j < (even ? s.parts / 2 : s.parts); j++) {
            const turn = m.spot.rot + j / s.parts;
            await cutLine(
              t,
              at(even ? turnPoint(g.r, turn + 0.5) : { x: 0, y: 0 }),
              at(turnPoint(g.r, turn)),
            );
          }
        } else {
          const { pieces, W, H } = g;
          const xs = [...new Set(pieces.map((p) => p.c.x - p.w / 2))].filter((x) => x > -W / 2 + 1);
          const ys = [...new Set(pieces.map((p) => p.c.y - p.h / 2))].filter((y) => y > -H / 2 + 1);
          for (const x of xs) await cutLine(t, at({ x, y: -H / 2 }), at({ x, y: H / 2 }));
          for (const y of ys) await cutLine(t, at({ x: -W / 2, y }), at({ x: W / 2, y }));
        }
        if (!live(t)) return;
        setCuts([]);
        update((all) => all.map((x) => ({ ...x, uncut: false })));
        await Promise.all(
          g.pieces.map((p, i) => {
            const L = Math.hypot(p.c.x, p.c.y) || 1;
            const d = g.unit * 0.07;
            return place(m, i, { x: (p.c.x / L) * d, y: (p.c.y / L) * d }, 1, 350);
          }),
        );
        await countSlices(
          t,
          g.pieces.map((_, i) => ({ w: 0, i })),
          (n) => `${n}`,
        );
        bubble(top(), `${s.parts} equal ${g.round ? 'slices' : 'pieces'}`, true);
      },

      async each(t) {
        const m = modelsRef.current[0];
        const friends = kids.length;
        const per = s.parts / friends;
        for (let i = 0; i < s.parts; i++) {
          if (!live(t)) return;
          const kid = layout!.kids[i % friends];
          const nth = Math.floor(i / friends);
          const c = geo(m).pieces[i].c;
          const scale = 0.4;
          update((all) => all.map((x) => ({ ...x, lifted: [...x.lifted, i] })));
          await place(
            m,
            i,
            {
              x: kid.x + (nth - (per - 1) / 2) * 10 - m.spot.x - scale * c.x,
              y: kid.y - 30 - m.spot.y - scale * c.y,
            },
            scale,
            560,
          );
        }
        for (const kid of layout!.kids) {
          bubble({ x: kid.x, y: kid.y - 62 }, unit === 'count' ? `${per}` : fraction(per, s.parts));
        }
        await wait(COUNT_MS);
        bubble(
          top(),
          unit === 'count'
            ? `${s.parts} ÷ ${friends} = ${per} each`
            : `${per} of ${s.parts} each = ${fraction(per, s.parts)}`,
          true,
        );
      },

      async same(t) {
        const m = modelsRef.current[0];
        const g = geo(m);
        const off = offsetOf(m);
        const into = s.cutInto!;
        const n = (s.picked! * into) / s.parts;
        if (g.round && into % s.parts === 0) {
          const f = into / s.parts;
          for (const i of m.picked) {
            for (let j = 1; j < f; j++) {
              const turn = m.spot.rot + (i + j / f) / s.parts;
              const at = (p: Pt) => ({ x: m.spot.x + off.x + p.x, y: m.spot.y + off.y + p.y });
              await cutLine(t, at({ x: 0, y: 0 }), at(turnPoint(g.r, turn)));
            }
          }
        }
        await wait(250);
        if (!live(t)) return;
        const swapped: Model = {
          ...m,
          key: `w0-${ids.current++}`,
          parts: into,
          picked: Array.from({ length: n }, (_, i) => i),
          lifted: Array.from({ length: n }, (_, i) => i),
          gone: [],
          offset: off,
        };
        for (let i = 0; i < into; i++) {
          void place(swapped, i, i < n ? off : { x: 0, y: 0 }, 1, 0);
          anim(`${swapped.key}:${i}`).o.setValue(1);
        }
        update(() => [swapped]);
        setCuts([]);
        setBubbles([]);
        await countSlices(
          t,
          Array.from({ length: n }, (_, i) => ({ w: 0, i })),
          (k) => fraction(k, into),
        );
        bubble(top(), `${fraction(s.picked!, s.parts)} = ${fraction(n, into)}`, true);
      },

      async bigger(t) {
        const meet = layout!.meet;
        for (const m of modelsRef.current) {
          if (!live(t)) return;
          await place(m, 0, { x: meet.x - m.spot.x, y: meet.y - m.spot.y }, 1, 700);
        }
        const big = Math.min(s.parts, s.other!);
        const small = Math.max(s.parts, s.other!);
        bubble(
          { x: meet.x, y: meet.y + modelsRef.current[0].spot.h * 0.62 },
          s.want === 'smaller' ? `1/${small} is smaller` : `1/${big} is bigger`,
          true,
        );
      },

      async add(t) {
        const a = s.picked!;
        const b = s.more!;
        const label = (n: number) => (unit === 'count' ? `${n}` : fraction(n, s.parts));
        const pickFirst = async (count: number) => {
          for (let w = 0; w < modelsRef.current.length; w++) {
            const list = Array.from({ length: s.parts }, (_, i) => i).filter(
              (i) => w * s.parts + i < count,
            );
            await pick(w, list);
          }
        };
        await pickFirst(a);
        await countSlices(
          t,
          Array.from({ length: a }, (_, g) => slotOf(s, g)),
          label,
        );
        await wait(500);
        if (!live(t)) return;
        setBubbles([]);
        await pickFirst(a + b);
        await countSlices(
          t,
          Array.from({ length: a + b }, (_, g) => slotOf(s, g)),
          label,
        );
        bubble(
          top(),
          unit === 'count'
            ? `${a} + ${b} = ${a + b}`
            : `${label(a)} + ${label(b)} = ${label(a + b)}`,
          true,
        );
      },
    };

    return {
      async play() {
        const t = ++run.current;
        if (!layout) return;
        await plays[s.ask](t);
      },
      async reset() {
        run.current += 1;
        if (layout) setup(layout);
      },
    };
  });

  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -12] });

  return (
    <View style={styles.stage} onLayout={onLayout}>
      {layout && (
        <>
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={box.w} height={box.h}>
              {models.map((m) => {
                const g = geo(m);
                return (
                  <G key={m.key} x={m.spot.x} y={m.spot.y}>
                    <Underlay food={s.food} whole={g} />
                    <Gaps whole={g} food={s.food} at={g.pieces.map((_, i) => i)} />
                  </G>
                );
              })}
              {layout.kids.map((k, i) => (
                <Ellipse
                  key={i}
                  cx={k.x}
                  cy={k.y - 22}
                  rx={30}
                  ry={10}
                  fill="#FFFFFF"
                  stroke="#E4D7B8"
                  strokeWidth={1.5}
                />
              ))}
            </Svg>
          </View>
          {layout.kids.map((k, i) => (
            <Animated.View
              key={i}
              style={[
                styles.kid,
                { left: k.x - 40, top: k.y - 4 },
                cheer && { transform: [{ translateY: hopY }] },
              ]}
            >
              <Text style={styles.kidEmoji}>{kids[i].emoji}</Text>
              <Text style={styles.kidName} numberOfLines={1}>
                {kids[i].name}
              </Text>
            </Animated.View>
          ))}
          {models.flatMap((m) => {
            const g = geo(m);
            return g.pieces.map((_, i) => (
              <SliceView
                key={`${m.key}:${i}`}
                model={m}
                whole={g}
                i={i}
                food={s.food}
                anim={anim(`${m.key}:${i}`)}
                bites={bites[`${m.key}:${i}`]}
              />
            ));
          })}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg width={box.w} height={box.h}>
              {cuts.map((c) => (
                <Line
                  key={c.id}
                  x1={c.a.x}
                  y1={c.a.y}
                  x2={c.a.x + (c.b.x - c.a.x) * c.k}
                  y2={c.a.y + (c.b.y - c.a.y) * c.k}
                  stroke={colors.ink}
                  strokeWidth={3}
                  strokeLinecap="round"
                />
              ))}
            </Svg>
          </View>
          {crumbs.map((c) => (
            <CrumbView
              key={c.id}
              crumb={c}
              onDone={() => setCrumbs((all) => all.filter((x) => x.id !== c.id))}
            />
          ))}
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
        </>
      )}
    </View>
  );
}

function SliceView({
  model: m,
  whole: g,
  i,
  food,
  anim,
  bites,
}: {
  model: Model;
  whole: Whole;
  i: number;
  food: SliceScene['food'];
  anim: Anim;
  bites?: Bites;
}) {
  const id = `sv${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const box = Math.max(g.W, g.H) + 16;
  const p = g.pieces[i];
  const lifted = m.lifted.includes(i);
  const picked = m.picked.includes(i);
  const holes = bites
    ? bites.rows.slice(0, bites.n + 1).flatMap((row, r) =>
        row.flatMap((b) => {
          const k = r < bites.n ? 1 : bites.k;
          const n = { x: -b.u.y, y: b.u.x };
          const t = b.r * 0.5;
          const f = b.r * 0.35;
          // A main bite and two smaller ones ahead of it make a scalloped, toothy edge.
          return [
            { x: b.x, y: b.y, r: b.r * k },
            { x: b.x + n.x * t + b.u.x * f, y: b.y + n.y * t + b.u.y * f, r: b.r * 0.55 * k },
            { x: b.x - n.x * t + b.u.x * f, y: b.y - n.y * t + b.u.y * f, r: b.r * 0.55 * k },
          ];
        }),
      )
    : [];
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.slice,
        {
          left: m.spot.x - box / 2,
          top: m.spot.y - box / 2,
          width: box,
          height: box,
          opacity: anim.o,
          transform: [...anim.xy.getTranslateTransform(), { scale: anim.s }],
        },
      ]}
    >
      <Svg width={box} height={box}>
        <Defs>
          <ClipPath id={`${id}c`}>
            <Path d={p.d} />
          </ClipPath>
          {holes.length > 0 && (
            <Mask
              id={`${id}m`}
              maskUnits="userSpaceOnUse"
              x={-box}
              y={-box}
              width={box * 2}
              height={box * 2}
            >
              <Rect x={-box} y={-box} width={box * 2} height={box * 2} fill="#FFFFFF" />
              {holes.map((h, k) => (
                <Circle key={k} cx={h.x} cy={h.y} r={Math.max(0, h.r)} fill="#000000" />
              ))}
            </Mask>
          )}
        </Defs>
        <G x={box / 2} y={box / 2}>
          {lifted && food && <Path d={p.d} fill={colors.ink} opacity={0.22} x={2} y={6} />}
          <G mask={holes.length > 0 ? `url(#${id}m)` : undefined}>
            <G clipPath={`url(#${id}c)`}>
              <FoodArt food={food} whole={g} />
            </G>
            {picked && !food && <Path d={p.d} fill={PICKED_FILL} />}
            <Path
              d={p.d}
              fill="none"
              strokeLinejoin="round"
              opacity={m.uncut ? 0 : 1}
              {...edgeLook(food)}
            />
          </G>
        </G>
      </Svg>
    </Animated.View>
  );
}

function BubbleView({ bubble: b }: { bubble: Bubble }) {
  const [pop] = useState(() => new Animated.Value(0.3));
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: NATIVE, friction: 5 }).start();
  }, [pop]);
  const size = b.big ? 20 : 16;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        b.big && styles.bigBubble,
        { left: b.x - 120, top: b.y - size, transform: [{ scale: pop }] },
      ]}
    >
      <Text style={[styles.bubbleText, b.big && styles.bigText, { fontSize: size }]}>{b.text}</Text>
    </Animated.View>
  );
}

function CrumbView({ crumb: c, onDone }: { crumb: Crumb; onDone: () => void }) {
  const done = useRef(onDone);
  useEffect(() => {
    Animated.timing(c.fall, { toValue: 1, duration: 520, useNativeDriver: NATIVE }).start(() =>
      done.current(),
    );
  }, [c]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.crumb,
        {
          left: c.x,
          top: c.y,
          backgroundColor: c.color,
          opacity: c.fall.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [
            { translateY: c.fall.interpolate({ inputRange: [0, 1], outputRange: [0, 16] }) },
          ],
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, margin: 8 },
  slice: { position: 'absolute' },
  kid: { position: 'absolute', width: 80, alignItems: 'center' },
  kidEmoji: { fontSize: 34, lineHeight: 40 },
  kidName: { fontSize: 14, fontWeight: '700', color: colors.softInk },
  bubble: {
    position: 'absolute',
    width: 240,
    alignItems: 'center',
  },
  bigBubble: {},
  bubbleText: {
    fontWeight: '800',
    color: colors.ink,
    backgroundColor: '#FFFFFF',
    borderColor: colors.line,
    borderWidth: 1.5,
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  bigText: {
    color: colors.background,
    backgroundColor: colors.ink,
    borderColor: colors.ink,
    paddingHorizontal: 14,
  },
  crumb: { position: 'absolute', width: 4, height: 4, borderRadius: 2 },
});
