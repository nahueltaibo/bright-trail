import type { LineupScene } from '@bright-trail/shared';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { color, font, radius } from '../../design/tokens';
import { Text } from '../../design/Text';
import { wait } from '../minigames/motion';
import { colors } from '../theme';
import type { Narrate } from '../types';
import { LineupArt } from './LineupArt';
import { ordinal, SHORT, slotsOf, thingWord } from './layout';

const NATIVE = Platform.OS !== 'web';
const WALK_MS = 420;
/** Time for the narrator to say one place before the next. */
const SAY_MS = 650;

export type LineupStageHandle = {
  /** Walks the line in one by one while the narrator counts the places, then fades the badges. */
  lineUp(): Promise<void>;
  /** Counts up to the asked place again and marks it. `tapped` is the place a wrong tap picked. */
  play(tapped: number | null): Promise<void>;
  /** Clears the count and the marks for another try. */
  reset(): Promise<void>;
};

type Props = {
  scene: LineupScene;
  cheer?: boolean;
  handle?: Ref<LineupStageHandle>;
  narrate?: Narrate;
  /** Set while the child can answer by tapping one in line. Takes the place, from 1. */
  onTap?: (place: number) => void;
  /** Places already tapped wrong, faded for another try. */
  tried?: readonly number[];
};

type Mark = 'lit' | 'hit' | 'miss';

/** A line of animals or kids with its front at the flag. Driven through `handle`. */
export function LineupStage({ scene, cheer, handle, narrate, onTap, tried = [] }: Props) {
  const n = scene.line.length;
  const [box, setBox] = useState({ width: 0, height: 0 });
  const { width } = box;
  const [walk] = useState(() => scene.line.map(() => new Animated.Value(0)));
  const [badges, setBadges] = useState<boolean[]>(() => scene.line.map(() => false));
  const [marks, setMarks] = useState<(Mark | null)[]>(() => scene.line.map(() => null));
  const [hop] = useState(() => new Animated.Value(0));
  const run = useRef(0);
  const narrateRef = useRef(narrate);
  useEffect(() => {
    narrateRef.current = narrate;
  });

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

  const setAt = <T,>(set: (f: (all: T[]) => T[]) => void, i: number, v: T) =>
    set((all) => all.map((x, j) => (j === i ? v : x)));

  useImperativeHandle(handle, () => {
    const live = (t: number) => run.current === t;
    const count = async (t: number, upTo: number) => {
      for (let i = 0; i < upTo; i++) {
        if (!live(t)) return;
        setAt(setBadges, i, true);
        setAt(setMarks, i, 'lit');
        narrateRef.current?.([ordinal(i + 1)]);
        await wait(SAY_MS);
        if (i < upTo - 1) setAt(setMarks, i, null);
      }
    };
    return {
      async lineUp() {
        const t = ++run.current;
        walk.forEach((v) => v.setValue(0));
        setBadges(scene.line.map(() => false));
        setMarks(scene.line.map(() => null));
        for (let i = 0; i < n; i++) {
          if (!live(t)) return;
          await new Promise<void>((done) =>
            Animated.timing(walk[i], {
              toValue: 1,
              duration: WALK_MS,
              easing: Easing.out(Easing.quad),
              useNativeDriver: NATIVE,
            }).start(() => done()),
          );
          if (!live(t)) return;
          setAt(setBadges, i, true);
          narrateRef.current?.([ordinal(i + 1)]);
          await wait(SAY_MS - 200);
        }
        await wait(500);
        if (live(t)) setBadges(scene.line.map(() => false));
      },
      async play(tapped) {
        const t = ++run.current;
        if (tapped !== null) setAt(setMarks, tapped - 1, 'miss');
        // Lets "Let's see" finish before the count starts.
        await wait(900);
        await count(t, scene.place);
        if (live(t)) setAt(setMarks, scene.place - 1, 'hit');
      },
      async reset() {
        run.current += 1;
        setBadges(scene.line.map(() => false));
        setMarks(scene.line.map(() => null));
        await wait(50);
      },
    };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox({ width: w, height: h });
  };
  const { slot, art, x } = slotsOf(scene, width, box.height);
  const badge = Math.min(40, slot - 6);
  const badgeH = Math.min(26, badge * 0.7);
  // The line stands on the ground's top edge, a third of the way up, with its badges below.
  const ground = Math.max(badgeH + 18, box.height * 0.34);
  const bounce = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });

  return (
    <View style={styles.stage} onLayout={onLayout} testID="lineup-stage">
      <View style={[styles.ground, { height: ground }]} />
      <View style={[styles.flag, { bottom: ground - 2 }]} pointerEvents="none">
        <Svg width={24} height={64} viewBox="0 0 24 64">
          <Rect x={3} y={2} width={3} height={62} rx={1.5} fill={colors.softInk} />
          <Path
            d="M6 4h15l-4 7 4 7H6z"
            fill={color.trail}
            stroke={color.trailDeep}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      {width > 0 &&
        scene.line.map((thing, i) => {
          const place = i + 1;
          const mark = marks[i];
          const faded = tried.includes(place) && !mark;
          const from = width + 20 + i * 14 - x(i);
          const translateX = walk[i].interpolate({ inputRange: [0, 1], outputRange: [from, 0] });
          const bob = walk[i].interpolate({
            inputRange: [0, 0.25, 0.5, 0.75, 1],
            outputRange: [0, -5, 0, -5, 0],
          });
          const cheering = cheer && place === scene.place;
          return (
            <Pressable
              key={i}
              testID={`lineup-place-${place}`}
              accessibilityRole="button"
              accessibilityLabel={
                scene.name && place === scene.place ? scene.name : thingWord(thing)
              }
              accessibilityState={{ disabled: !onTap || faded }}
              disabled={!onTap || faded}
              onPress={() => onTap?.(place)}
              style={[
                styles.column,
                { left: x(i), width: slot, paddingBottom: ground - badgeH - 12 },
              ]}
            >
              <Animated.View
                style={[
                  styles.walker,
                  faded && styles.faded,
                  { transform: [{ translateX }, { translateY: cheering ? bounce : bob }] },
                ]}
              >
                <View
                  style={[
                    styles.ring,
                    { borderRadius: Math.min(18, art / 3) },
                    onTap && !faded && styles.ready,
                    mark === 'lit' && styles.lit,
                    mark === 'hit' && styles.hit,
                    mark === 'miss' && styles.miss,
                  ]}
                >
                  <LineupArt thing={thing} index={i} size={art} />
                </View>
                {scene.name && place === scene.place && mark === 'hit' && (
                  <Text style={styles.name}>{scene.name}</Text>
                )}
              </Animated.View>
              <View
                testID={badges[i] ? `lineup-badge-${place}` : undefined}
                style={[
                  styles.badge,
                  { width: badge, height: badgeH },
                  badges[i] && styles.badgeOn,
                ]}
              >
                <Text style={[styles.badgeText, { fontSize: Math.min(15, badge * 0.4) }]}>
                  {badges[i] ? SHORT[i] : ''}
                </Text>
              </View>
            </Pressable>
          );
        })}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    margin: 8,
    overflow: 'hidden',
    borderRadius: radius.xl,
    backgroundColor: color.meadow,
  },
  ground: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  flag: { position: 'absolute', left: 6 },
  // The whole column is the tap area, top to bottom, so small art still takes an easy tap.
  column: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
  },
  walker: { alignItems: 'center' },
  faded: { opacity: 0.35 },
  ring: { borderWidth: 3, borderColor: 'transparent', padding: 1 },
  ready: { borderColor: colors.line, backgroundColor: colors.raised },
  lit: { borderColor: color.trail, backgroundColor: color.sun },
  hit: { borderColor: colors.goodInk, backgroundColor: colors.good },
  miss: { borderColor: colors.gentleInk, backgroundColor: colors.gentle },
  name: {
    ...font.display(700),
    fontSize: 14,
    color: colors.ink,
    position: 'absolute',
    top: -20,
  },
  badge: {
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 2,
    borderColor: colors.line,
  },
  badgeOn: { backgroundColor: color.trail, borderColor: color.trail },
  badgeText: { ...font.display(800), color: color.onTrail },
});
