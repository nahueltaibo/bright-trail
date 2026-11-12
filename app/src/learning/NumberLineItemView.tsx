import { defaultHops, type Hops, type NumberLineItem } from '@bright-trail/shared';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  StyleSheet,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { font, radius } from '../design/tokens';
import { KidButton } from './controls';
import { ItemFrame, useItemAttempt } from './ItemFrame';
import { ARC, ARC_TEXT, arcPath, FROG, type Arc } from './hopArc';
import { BubbleView, type Bubble } from './minigames/Bubble';
import { frames, wait } from './minigames/motion';
import {
  indexAtFraction,
  indexOfValue,
  labelEvery,
  lineLabel,
  stepCount,
  valueAt,
} from './numberLine';
import { colors, formatNumber, useLayout } from './theme';
import type { ItemViewProps } from './types';
import { Text } from '../design/Text';

type Phase = 'ask' | 'playing' | 'done';
type ArcLabel = { id: number; x: number; y: number; text: string };

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const tidy = (v: number) => Number(v.toFixed(9));

/**
 * Drag the frog along the line, or tap anywhere on it, and it snaps to the nearest step.
 * Arrow buttons nudge one step for kids who find dragging hard. After a check, the frog hops the
 * story out from its start, counting each landing, before the feedback shows.
 */
export function NumberLineItemView(props: ItemViewProps<NumberLineItem>) {
  const { item } = props;
  const { scale } = useLayout();
  const { outcome, answer, replay } = useItemAttempt(props);
  const [index, setIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [phase, setPhase] = useState<Phase>('ask');
  const [arcs, setArcs] = useState<Arc[]>([]);
  const [labels, setLabels] = useState<ArcLabel[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [frogX] = useState(() => new Animated.Value(0));
  const [frogY] = useState(() => new Animated.Value(0));
  const [frogTurn] = useState(() => new Animated.Value(0));
  // Page x of the track's left edge, so drag moves don't depend on which view is under the finger.
  const trackLeft = useRef(0);
  const run = useRef(0);
  const ids = useRef(0);

  const n = stepCount(item);
  const every = labelEvery(n);
  const targetIndex = indexOfValue(item.target, item);
  const markerSize = 56 * scale;
  const pad = markerSize / 2 + 8;
  const usable = Math.max(0, width - pad * 2);
  const xOf = (i: number) => pad + (i / n) * usable;
  const xAt = (v: number) => pad + ((v - item.min) / (item.max - item.min)) * usable;
  // Room above the frog for the hop arcs and the counting bubbles.
  const arcRoom = 64 * scale;
  const lineY = arcRoom + markerSize + 16;
  const frogTop = lineY - markerSize - 6;
  const height = lineY + 96 * scale;
  const locked = phase !== 'ask';
  const label = (v: number) => lineLabel(v, item);

  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((on) => live && setReduceMotion(on))
      .catch(() => {});
    const runs = run;
    return () => {
      live = false;
      runs.current += 1;
    };
  }, []);

  const placeAt = (x: number) => {
    if (usable <= 0 || locked) return;
    setIndex(indexAtFraction((x - pad) / usable, item));
  };
  const nudge = (delta: number) =>
    setIndex((i) => (i === null ? 0 : Math.min(n, Math.max(0, i + delta))));
  const onAccessibilityAction = (e: AccessibilityActionEvent) => {
    if (e.nativeEvent.actionName === 'increment') nudge(1);
    if (e.nativeEvent.actionName === 'decrement') nudge(-1);
  };

  /** The frog jumps to the path's start, then hops each leg, leaving arcs and counting landings. */
  const playOut = async (from: number, path: Hops) => {
    const t = ++run.current;
    const live = () => run.current === t;
    const ms = (v: number) => (reduceMotion ? 0 : v);
    const bubble = (x: number, text: string, big = false) =>
      setBubbles((b) => [...b, { id: ids.current++, x, y: 14 * scale + 6, text, big }]);
    const setFrog = (x: number, lift: number, turn: number) => {
      frogX.setValue(x - markerSize / 2);
      frogY.setValue(frogTop - lift);
      frogTurn.setValue(turn);
    };

    const x0 = xAt(from);
    setFrog(x0, 0, 0);
    const xs = xAt(path.start);
    await frames(
      ms(420),
      (k) => setFrog(x0 + (xs - x0) * ease(k), Math.sin(k * Math.PI) * 30 * scale, 0),
      live,
    );
    if (!live()) return;
    bubble(xs, `Start at ${label(path.start)}`);
    await wait(ms(650));
    if (!live()) return;

    let v = path.start;
    for (const leg of path.legs) {
      const legStart = v;
      const sign = leg.by < 0 ? '−' : '+';
      const hopText = `${sign}${label(Math.abs(leg.by))}`;
      // A hop gets its own label only when the label fits over its arc.
      const ownLabel = Math.abs(xAt(leg.by) - xAt(0)) >= (hopText.length * 9 + 10) * scale;
      let highest = lineY;
      for (let i = 0; i < leg.times; i++) {
        const next = tidy(v + leg.by);
        const a = xAt(v);
        const b = xAt(next);
        const dist = Math.abs(b - a);
        const h = Math.min(58 * scale, 14 * scale + dist * 0.45);
        const arc: Arc = { id: ids.current++, x0: a, x1: b, top: lineY - 14 - h, k: 0 };
        highest = Math.min(highest, arc.top);
        setArcs((all) => [...all, arc]);
        await frames(
          ms(Math.min(620, 300 + dist * 2.2)),
          (k) => {
            const e = ease(k);
            const dir = b >= a ? 1 : -1;
            setFrog(a + (b - a) * e, 4 * h * e * (1 - e), dir * Math.sin(k * Math.PI * 2) * 10);
            setArcs((all) => all.map((x) => (x.id === arc.id ? { ...x, k: e } : x)));
          },
          live,
        );
        if (!live()) return;
        if (ownLabel) {
          setLabels((l) => [
            ...l,
            { id: ids.current++, x: (a + b) / 2, y: arc.top - 18, text: hopText },
          ]);
        }
        setBubbles([]);
        bubble(b, label(next));
        v = next;
        await wait(ms(path.legs.length > 1 ? 260 : 160));
        if (!live()) return;
      }
      // Hops too short for their own label get one label for the whole run.
      if (!ownLabel) {
        setLabels((l) => [
          ...l,
          {
            id: ids.current++,
            x: (xAt(legStart) + xAt(v)) / 2,
            // Short hops leave low arcs, so the label goes above the frog instead.
            y: Math.min(highest, frogTop) - 20,
            text: leg.times > 1 ? `${leg.times} hops of ${hopText}` : hopText,
          },
        ]);
      }
    }
    await wait(ms(300));
    if (!live()) return;
    setBubbles([]);
    bubble(width / 2, `It lands on ${label(item.target)}`, true);
  };

  const submit = () => {
    if (index === null || locked) return;
    const value = valueAt(index, item);
    setPhase('playing');
    const played = usable > 0 ? playOut(value, item.hops ?? defaultHops(item)) : Promise.resolve();
    answer(
      value,
      index === targetIndex,
      [],
      played.then(() => setPhase('done')),
    );
  };

  const ticks = Array.from({ length: n + 1 }, (_, i) => i);
  const placedValue = index === null ? null : formatNumber(valueAt(index, item));
  const missed = outcome ? !outcome.correct : index !== null && index !== targetIndex;

  return (
    <ItemFrame {...props} replay={replay} outcome={outcome}>
      <View
        testID="number-line-track"
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={`Number line from ${formatNumber(item.min)} to ${formatNumber(item.max)}`}
        accessibilityValue={{ text: placedValue ?? 'Frog not placed' }}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAccessibilityAction}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => !locked}
        onMoveShouldSetResponder={() => !locked}
        // Keep the drag even if a parent scroll view asks for it.
        onResponderTerminationRequest={() => false}
        onResponderGrant={(e: GestureResponderEvent) => {
          trackLeft.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
          placeAt(e.nativeEvent.locationX);
        }}
        onResponderMove={(e: GestureResponderEvent) =>
          placeAt(e.nativeEvent.pageX - trackLeft.current)
        }
        style={[styles.track, { height }]}
      >
        <View style={[StyleSheet.absoluteFill, styles.noTouch]}>
          <View style={[styles.line, { top: lineY - 3, left: pad, right: pad }]} />
          {ticks.map((i) => {
            const major = i % every === 0 || i === n;
            return (
              <View key={i}>
                <View
                  style={[
                    styles.tick,
                    major ? styles.tickMajor : styles.tickMinor,
                    { left: xOf(i) - 1.5, top: lineY - (major ? 14 : 8) },
                  ]}
                />
                {major && (
                  <Text
                    style={[
                      styles.label,
                      { left: xOf(i) - 30, top: lineY + 18, fontSize: 22 * scale },
                    ]}
                  >
                    {label(valueAt(i, item))}
                  </Text>
                )}
              </View>
            );
          })}
          {width > 0 && arcs.length > 0 && (
            <View style={StyleSheet.absoluteFill}>
              <Svg width={width} height={height}>
                {arcs.map((a) => (
                  <Path
                    key={a.id}
                    d={arcPath(a, lineY)}
                    fill="none"
                    stroke={ARC}
                    strokeWidth={2.5 * scale}
                    strokeDasharray={[6 * scale, 5 * scale]}
                    strokeLinecap="round"
                  />
                ))}
              </Svg>
            </View>
          )}
          {labels.map((l) => (
            <Text
              key={l.id}
              style={[styles.arcLabel, { left: l.x - 70, top: l.y, fontSize: 14 * scale }]}
            >
              {l.text}
            </Text>
          ))}
          {outcome && !outcome.correct && (
            <View
              testID="number-line-target"
              accessible
              accessibilityLabel={`The answer is ${formatNumber(item.target)}`}
              style={[
                styles.target,
                { left: xOf(targetIndex) - 26 * scale, top: lineY + 48 * scale, width: 52 * scale },
              ]}
            >
              <Text style={[styles.targetText, { fontSize: 20 * scale }]}>
                {label(item.target)}
              </Text>
            </View>
          )}
          {locked && missed && index !== null && (
            <Text
              style={[
                styles.marker,
                styles.ghost,
                markerStyle(markerSize),
                { left: xOf(index) - markerSize / 2, top: frogTop },
              ]}
            >
              {FROG}
            </Text>
          )}
          {locked ? (
            <Animated.Text
              testID="number-line-marker"
              style={[
                styles.marker,
                markerStyle(markerSize),
                {
                  left: 0,
                  top: 0,
                  transform: [
                    { translateX: frogX },
                    { translateY: frogY },
                    {
                      rotate: frogTurn.interpolate({
                        inputRange: [-90, 90],
                        outputRange: ['-90deg', '90deg'],
                      }),
                    },
                  ],
                },
              ]}
            >
              {FROG}
            </Animated.Text>
          ) : (
            <Text
              testID="number-line-marker"
              style={[
                styles.marker,
                markerStyle(markerSize),
                { left: xOf(index ?? 0) - markerSize / 2, top: frogTop },
                index === null && styles.markerParked,
              ]}
            >
              {FROG}
            </Text>
          )}
          {bubbles.map((b) => (
            <BubbleView key={b.id} bubble={b} />
          ))}
        </View>
      </View>
      {!locked && (
        <View style={styles.controls}>
          <KidButton label="Move left" icon="back" variant="plain" onPress={() => nudge(-1)} />
          <KidButton
            label="Check my answer"
            icon="check"
            disabled={index === null}
            onPress={submit}
          />
          <KidButton label="Move right" icon="next" variant="plain" onPress={() => nudge(1)} />
        </View>
      )}
    </ItemFrame>
  );
}

const markerStyle = (size: number) => ({ fontSize: size * 0.8, lineHeight: size, width: size });

const styles = StyleSheet.create({
  // No text selection on web while dragging.
  track: { alignSelf: 'stretch', userSelect: 'none' },
  noTouch: { pointerEvents: 'none' },
  line: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: colors.ink },
  tick: { position: 'absolute', width: 3, borderRadius: 2, backgroundColor: colors.ink },
  tickMajor: { height: 28 },
  tickMinor: { height: 16, opacity: 0.6 },
  label: {
    position: 'absolute',
    width: 60,
    textAlign: 'center',
    color: colors.ink,
    ...font.display(700),
  },
  arcLabel: {
    position: 'absolute',
    width: 140,
    textAlign: 'center',
    color: ARC_TEXT,
    ...font.body(700),
  },
  target: {
    position: 'absolute',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.good,
    borderWidth: 3,
    borderColor: colors.goodInk,
  },
  targetText: { color: colors.goodInk, ...font.display(800) },
  marker: { position: 'absolute', textAlign: 'center' },
  // Waiting at the start, faded, until the child places it.
  markerParked: { opacity: 0.45 },
  // Where the child put the frog, after a miss.
  ghost: { opacity: 0.38 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
});
