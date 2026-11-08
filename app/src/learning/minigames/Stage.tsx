import { formatAmount, MAX_CUT, type Amount, type ContainerKind } from '@bright-trail/shared';
import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type Ref,
} from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BarStrips, isRound, Wedge, WholeThing } from '../food/ThingArt';
import { turnPoint } from '../food/geometry';
import { colors } from '../theme';
import { AmountText } from './AmountText';
import { Container } from './Container';
import {
  LABEL_HEIGHT,
  layoutStage,
  planDeal,
  planFill,
  type DealPlan,
  type Point,
  type Side,
  type Thing,
} from './share';

const NATIVE = Platform.OS !== 'web';
const MOVE_MS = 420;
const GAP_MS = 120;
const CUT_MS = 350;
const RETURN_MS = 500;
const PULSE_MS = 160;
/** Gap between the pieces of a cut thing on the sharer's plate. */
const CUT_GAP = 4;

type Spot = { receiver: number; slot: number; at: number };
/** What a receiver holds: whole things, and pieces of 1/den. */
type Share = { wholes: number; pieces: number; den: number };
export type Tone = 'good' | 'gentle';

export type StageHandle = {
  /** Deals `amount` to each receiver from the sharer's plate. */
  deal(amount: Amount): Promise<DealPlan>;
  /** Puts a number on each thing still on the sharer's plate. Returns how many. */
  countLeft(): Promise<number>;
  /** Fills receivers one at a time with `each`, showing each as it gets its first thing. */
  fill(each: number): Promise<void>;
  /** Moves every thing from the receivers back to the sharer's plate, counting up. */
  collect(): Promise<void>;
  /** Counts each receiver's things, one pulse at a time. */
  countUp(): Promise<void>;
  /** Puts everything back where it started. */
  reset(): Promise<void>;
};

export type StageProps = {
  side: Side;
  thing: Thing;
  container: ContainerKind;
  total: number;
  slotsEach: number;
  scale: number;
  /** Things each receiver starts with. By default all start on the sharer's plate. */
  start?: number[];
  /** No sharer or plate on top: the things start with the receivers. */
  noSource?: boolean;
  /** Hides receivers until they get their first thing, so the child can't count them first. */
  hideEmpty?: boolean;
  /** Dashed spots for the amount being dealt. */
  outline?: Pick<Amount, 'whole' | 'parts' | 'den'> | null;
  /** After the play-out: blue on the sharer's plate or on empty spots, a tone per receiver. */
  hint?: { source?: boolean; emptySpots?: boolean; receivers?: (Tone | null)[] };
  cheer?: boolean;
  /** Shows each receiver's count under its container. */
  counts?: boolean;
  handle?: Ref<StageHandle>;
};

function move(value: Animated.ValueXY, to: Point, duration: number): Promise<void> {
  return new Promise((resolve) =>
    Animated.timing(value, {
      toValue: to,
      duration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: NATIVE,
    }).start(() => resolve()),
  );
}

function pulse(value: Animated.Value): Promise<void> {
  return new Promise((resolve) =>
    Animated.sequence([
      Animated.timing(value, { toValue: 1.35, duration: PULSE_MS, useNativeDriver: NATIVE }),
      Animated.timing(value, { toValue: 1, duration: PULSE_MS, useNativeDriver: NATIVE }),
    ]).start(() => resolve()),
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const emptyShares = (n: number): Share[] =>
  Array.from({ length: n }, () => ({ wholes: 0, pieces: 0, den: 1 }));

/** Where things start: on the sharer's plate, or `start[r]` things in each receiver's slots. */
function startSpots(start: readonly number[] | undefined): Map<number, Spot> {
  const spots = new Map<number, Spot>();
  let t = 0;
  start?.forEach((count, receiver) => {
    for (let slot = 0; slot < count; slot++) spots.set(t++, { receiver, slot, at: 0 });
  });
  return spots;
}

const startShares = (groups: number, start: readonly number[] | undefined): Share[] =>
  start ? start.map((wholes) => ({ wholes, pieces: 0, den: 1 })) : emptyShares(groups);

/** One sharer, their plate of things, and the receivers. Driven through `handle`. */
export function Stage(props: StageProps) {
  const { side, thing, container, total, slotsEach, scale, start, hideEmpty, outline, hint } =
    props;
  const groups = side.receivers.length;

  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const geo = useMemo(
    () => (box ? layoutStage(box.w, box.h, total, groups, slotsEach, !props.noSource) : null),
    [box, total, groups, slotsEach, props.noSource],
  );

  const [wholes] = useState(() =>
    Array.from({ length: total }, () => new Animated.ValueXY({ x: 0, y: 0 })),
  );
  const [pieces] = useState(() =>
    Array.from({ length: total }, () =>
      Array.from({ length: MAX_CUT }, () => new Animated.ValueXY({ x: 0, y: 0 })),
    ),
  );
  const [pulses] = useState(() => Array.from({ length: total }, () => new Animated.Value(1)));
  const [hop] = useState(() => new Animated.Value(0));

  // Pieces a thing was cut into; 0 while whole.
  const [cutInto, setCutInto] = useState<number[]>(() => Array(total).fill(0));
  // Which strip of the picture a landed piece shows. A piece takes the strip of the spot it lands
  // on, so a receiver's pieces join into one part of a thing instead of repeating a strip.
  const [strips, setStrips] = useState<Record<string, number>>({});
  const [shares, setShares] = useState<Share[]>(() => startShares(groups, start));
  const [shown, setShown] = useState<boolean[]>(() =>
    Array.from({ length: groups }, (_, r) => !hideEmpty || (start?.[r] ?? 0) > 0),
  );
  const [leftLabels, setLeftLabels] = useState<Record<number, number>>({});
  const [collected, setCollected] = useState<number | null>(null);

  const placed = useRef(new Map<string, Spot>());
  const cutRef = useRef<number[]>([]);
  const run = useRef(0);

  // Round food cuts into wedges that stack in one slot. Everything else cuts into strips.
  const wedges = !!thing.food && isRound(thing.food);
  const slotAt = (s: Spot) => geo!.receivers[s.receiver].slots[s.slot];
  const pieceWidth = (t: number) => (wedges ? 0 : geo!.size / (cutRef.current[t] || 1));
  const pieceHome = (t: number, i: number, spread: boolean): Point => {
    const src = geo!.source[t];
    const den = cutRef.current[t] || 1;
    if (wedges) {
      const out = spread ? turnPoint(CUT_GAP * 1.5, (i + 0.5) / den) : { x: 0, y: 0 };
      return { x: src.x + out.x, y: src.y + out.y };
    }
    const gap = spread ? (i - (den - 1) / 2) * CUT_GAP : 0;
    return { x: src.x + (i * geo!.size) / den + gap, y: src.y };
  };

  // Things that start with a receiver are placed there before the first paint.
  useEffect(() => {
    startSpots(start).forEach((spot, t) => placed.current.set(`w${t}`, spot));
  }, [start]);

  // Snap everything to its spot whenever the stage size changes, e.g. on rotation.
  useEffect(() => {
    if (!geo) return;
    const spotPoint = (s: Spot) => geo.receivers[s.receiver].slots[s.slot];
    wholes.forEach((v, t) => {
      const s = placed.current.get(`w${t}`);
      v.setValue(s ? spotPoint(s) : geo.source[t]);
    });
    pieces.forEach((row, t) => {
      row.forEach((v, i) => {
        const s = placed.current.get(`p${t}:${i}`);
        v.setValue(
          s
            ? { x: spotPoint(s).x + s.at * pieceWidth(t), y: spotPoint(s).y }
            : pieceHome(t, i, !!cutRef.current[t]),
        );
      });
    });
    // Positions depend only on the stage size; the helpers read it from the same render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geo, wholes, pieces]);

  useEffect(() => {
    if (!props.cheer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 220, useNativeDriver: NATIVE }),
        Animated.timing(hop, { toValue: 0, duration: 220, useNativeDriver: NATIVE }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [props.cheer, hop]);

  useEffect(() => {
    const runs = run;
    return () => {
      runs.current += 1;
    };
  }, []);

  useImperativeHandle(props.handle, () => {
    const live = (token: number) => run.current === token;
    return {
      async deal(amount) {
        const token = ++run.current;
        const plan = planDeal(total, groups, amount);
        const tally = emptyShares(groups).map((s) => ({ ...s, den: amount.den }));
        for (const step of plan.steps) {
          if (!geo) break;
          if (step.kind === 'cut') {
            cutRef.current[step.thing] = amount.den;
            pieces[step.thing].forEach((v, i) => v.setValue(pieceHome(step.thing, i, false)));
            setCutInto([...cutRef.current]);
            await Promise.all(
              pieces[step.thing]
                .slice(0, amount.den)
                .map((v, i) => move(v, pieceHome(step.thing, i, true), CUT_MS)),
            );
          } else if (step.kind === 'whole') {
            const spot = { receiver: step.receiver, slot: step.slot, at: 0 };
            placed.current.set(`w${step.thing}`, spot);
            await move(wholes[step.thing], slotAt(spot), MOVE_MS);
            tally[step.receiver].wholes += 1;
          } else {
            const spot = { receiver: step.receiver, slot: step.slot, at: step.at };
            placed.current.set(`p${step.thing}:${step.piece}`, spot);
            const to = slotAt(spot);
            await move(
              pieces[step.thing][step.piece],
              { x: to.x + step.at * pieceWidth(step.thing), y: to.y },
              MOVE_MS,
            );
            tally[step.receiver].pieces += 1;
            setStrips((m) => ({ ...m, [`${step.thing}:${step.piece}`]: step.at }));
          }
          if (!live(token)) return plan;
          setShares(tally.map((s) => ({ ...s })));
          await wait(GAP_MS);
        }
        return plan;
      },

      async countLeft() {
        const token = ++run.current;
        const left = wholes
          .map((_, t) => t)
          .filter((t) => !placed.current.has(`w${t}`) && !cutRef.current[t]);
        for (let n = 0; n < left.length; n++) {
          setLeftLabels((m) => ({ ...m, [left[n]]: n + 1 }));
          await pulse(pulses[left[n]]);
          if (!live(token)) break;
        }
        return left.length;
      },

      async fill(each) {
        const token = ++run.current;
        const tally = emptyShares(groups);
        for (const step of planFill(total, each)) {
          if (!geo) break;
          setShown((s) => s.map((v, r) => v || r === step.receiver));
          const spot = { receiver: step.receiver, slot: step.slot, at: 0 };
          placed.current.set(`w${step.thing}`, spot);
          await move(wholes[step.thing], slotAt(spot), MOVE_MS);
          if (!live(token)) return;
          tally[step.receiver].wholes += 1;
          setShares(tally.map((s) => ({ ...s })));
          await wait(GAP_MS);
        }
      },

      async collect() {
        const token = ++run.current;
        const tally = startShares(groups, start);
        setCollected(0);
        for (let t = 0; t < total; t++) {
          const spot = placed.current.get(`w${t}`);
          if (!spot || !geo) continue;
          placed.current.delete(`w${t}`);
          await move(wholes[t], geo.source[t], MOVE_MS);
          if (!live(token)) return;
          tally[spot.receiver].wholes -= 1;
          setShares(tally.map((s) => ({ ...s })));
          setCollected(t + 1);
          await wait(GAP_MS / 2);
        }
      },

      async countUp() {
        const token = ++run.current;
        const tally = emptyShares(groups);
        setShares(tally);
        for (let t = 0; t < total; t++) {
          const spot = placed.current.get(`w${t}`);
          if (!spot) continue;
          tally[spot.receiver].wholes += 1;
          setShares(tally.map((s) => ({ ...s })));
          await pulse(pulses[t]);
          if (!live(token)) return;
        }
      },

      async reset() {
        const token = ++run.current;
        if (!geo) return;
        const home = startSpots(start);
        await Promise.all([
          ...wholes.map((v, t) => {
            const s = home.get(t);
            return move(v, s ? slotAt(s) : geo.source[t], RETURN_MS);
          }),
          ...pieces.flatMap((row, t) =>
            cutRef.current[t]
              ? row
                  .slice(0, cutRef.current[t])
                  .map((v, i) => move(v, pieceHome(t, i, false), RETURN_MS))
              : [],
          ),
        ]);
        if (!live(token)) return;
        placed.current.clear();
        home.forEach((spot, t) => placed.current.set(`w${t}`, spot));
        cutRef.current = [];
        setCutInto(Array(total).fill(0));
        setStrips({});
        setShares(startShares(groups, start));
        setShown(Array.from({ length: groups }, (_, r) => !hideEmpty || (start?.[r] ?? 0) > 0));
        setLeftLabels({});
        setCollected(null);
      },
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox((b) => (b && b.w === width && b.h === height ? b : { w: width, h: height }));
  };

  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -14 * scale] });
  const objectText = (size: number) => ({
    width: size,
    height: size,
    fontSize: size * 0.75,
    lineHeight: size,
  });

  return (
    <View style={styles.stage} onLayout={onLayout}>
      {geo && (
        <>
          {!props.noSource && (
            <>
              <View style={[styles.abs, at(geo.sharer.at), { width: geo.sharer.size }]}>
                <Text style={[styles.emoji, emojiSize(geo.sharer.size)]}>{side.sharer.emoji}</Text>
                <Text style={styles.name} numberOfLines={1}>
                  {side.sharer.name}
                </Text>
              </View>
              <Container
                kind={container}
                rect={geo.sourcePlate}
                tone={hint?.source ? 'gentle' : undefined}
              />
            </>
          )}
          {collected !== null && (
            <View
              style={[
                styles.bubble,
                { left: geo.sourcePlate.x + geo.sourcePlate.w - 18, top: geo.sourcePlate.y - 18 },
              ]}
            >
              <Text style={[styles.bubbleText, { fontSize: 22 * scale }]}>{collected}</Text>
            </View>
          )}
          {side.receivers.map((receiver, r) => {
            const f = geo.receivers[r];
            const has = shares[r];
            const tone = hint?.receivers?.[r] ?? undefined;
            if (!shown[r]) return null;
            const wholeOutlines = outline ? Math.min(outline.whole, slotsEach) : 0;
            const part =
              outline && outline.parts > 0 && outline.whole < slotsEach
                ? f.slots[outline.whole]
                : null;
            return (
              <Fragment key={r}>
                <Animated.View
                  style={[
                    styles.abs,
                    {
                      left: f.avatar.x + geo.avatarSize / 2 - geo.columnWidth / 2,
                      top: f.avatar.y,
                      width: geo.columnWidth,
                    },
                    props.cheer && { transform: [{ translateY: hopY }] },
                  ]}
                >
                  {receiver.emoji ? (
                    <Text style={[styles.emoji, emojiSize(geo.avatarSize)]}>{receiver.emoji}</Text>
                  ) : (
                    // Plain containers get a number, so the child can count the groups.
                    <Text
                      style={[
                        styles.number,
                        { height: geo.avatarSize, lineHeight: geo.avatarSize },
                      ]}
                    >
                      {hideEmpty ? r + 1 : ''}
                    </Text>
                  )}
                  <Text style={styles.name} numberOfLines={1}>
                    {receiver.name ?? ''}
                  </Text>
                </Animated.View>
                <Container kind={container} rect={f.plate} tone={tone} />
                {f.slots.slice(0, wholeOutlines).map((slot, s) => (
                  <View
                    key={s}
                    style={[
                      styles.slot,
                      hint?.emptySpots && s >= has.wholes && styles.slotHint,
                      {
                        left: slot.x + 3,
                        top: slot.y + 3,
                        width: geo.size - 6,
                        height: geo.size - 6,
                      },
                    ]}
                  />
                ))}
                {part && outline && (
                  <View
                    style={[
                      styles.slot,
                      !wedges && styles.partSlot,
                      hint?.emptySpots && has.pieces < outline.parts && styles.slotHint,
                      {
                        left: part.x + (wedges ? 3 : 1),
                        top: part.y + 3,
                        width: wedges ? geo.size - 6 : (outline.parts * geo.size) / outline.den - 2,
                        height: geo.size - 6,
                      },
                    ]}
                  />
                )}
                {props.counts && (
                  <View
                    testID={`share-count-${r}`}
                    style={[
                      styles.count,
                      { left: f.plate.x, width: f.plate.w, top: f.plate.y + f.plate.h + 4 },
                    ]}
                  >
                    <AmountText
                      label={formatAmount(has.wholes + has.pieces / has.den)}
                      size={22 * scale}
                    />
                  </View>
                )}
              </Fragment>
            );
          })}
          {wholes.map((xy, t) =>
            cutInto[t] ? null : (
              <Animated.View
                key={`w${t}`}
                style={[
                  styles.object,
                  { width: geo.size, height: geo.size },
                  { transform: [...xy.getTranslateTransform(), { scale: pulses[t] }] },
                ]}
              >
                {thing.food ? (
                  <WholeThing food={thing.food} size={geo.size} />
                ) : (
                  <Text style={[styles.objectText, objectText(geo.size)]}>{thing.emoji}</Text>
                )}
                {leftLabels[t] !== undefined && (
                  <Text style={[styles.leftLabel, { fontSize: geo.size * 0.4 }]}>
                    {leftLabels[t]}
                  </Text>
                )}
              </Animated.View>
            ),
          )}
          {pieces.map((row, t) =>
            cutInto[t]
              ? row.slice(0, cutInto[t]).map((xy, i) => {
                  const w = geo.size / cutInto[t];
                  const strip = strips[`${t}:${i}`] ?? i;
                  if (wedges) {
                    return (
                      <Animated.View
                        key={`p${t}:${i}`}
                        style={[
                          styles.object,
                          { width: geo.size, height: geo.size },
                          { transform: xy.getTranslateTransform() },
                        ]}
                      >
                        <Wedge food={thing.food!} size={geo.size} den={cutInto[t]} index={strip} />
                      </Animated.View>
                    );
                  }
                  return (
                    <Animated.View
                      key={`p${t}:${i}`}
                      style={[
                        styles.piece,
                        { width: w, height: geo.size, transform: xy.getTranslateTransform() },
                      ]}
                    >
                      {thing.food ? (
                        <View style={[styles.pieceText, { left: -strip * w }]}>
                          <BarStrips food={thing.food} size={geo.size} den={cutInto[t]} />
                        </View>
                      ) : (
                        <Text
                          style={[styles.pieceText, objectText(geo.size), { left: -strip * w }]}
                        >
                          {thing.emoji}
                        </Text>
                      )}
                    </Animated.View>
                  );
                })
              : null,
          )}
        </>
      )}
    </View>
  );
}

const at = (p: Point) => ({ left: p.x, top: p.y });
const emojiSize = (side: number) => ({ fontSize: side * 0.8, lineHeight: side });

const styles = StyleSheet.create({
  stage: { flex: 1, margin: 8 },
  abs: { position: 'absolute', alignItems: 'center' },
  emoji: { textAlign: 'center' },
  number: { fontSize: 22, fontWeight: '800', color: colors.softInk, textAlign: 'center' },
  name: {
    height: LABEL_HEIGHT,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  slot: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  partSlot: { borderRadius: 8 },
  slotHint: { borderColor: colors.gentleInk, backgroundColor: colors.gentle },
  count: { position: 'absolute', alignItems: 'center' },
  object: { position: 'absolute', left: 0, top: 0 },
  objectText: { textAlign: 'center' },
  leftLabel: {
    position: 'absolute',
    right: -2,
    top: -2,
    fontWeight: '800',
    color: colors.gentleInk,
  },
  piece: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  pieceText: { position: 'absolute', top: 0, textAlign: 'center' },
  bubble: {
    position: 'absolute',
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  bubbleText: { fontWeight: '800', color: colors.ink },
});
