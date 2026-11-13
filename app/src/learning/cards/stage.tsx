import {
  type ComponentRef,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { font, radius } from '../../design/tokens';
import { Text } from '../../design/Text';
import { frames } from '../minigames/motion';
import { colors } from '../theme';

/** Every card stage draws on this world, scaled to fit its box. */
export const STAGE_W = 360;
export const STAGE_H = 300;

/** A card's centre and size, in world points. */
export type Box = { x: number; y: number; w: number; h: number };

/** What a ref to a stage's root view holds. */
export type ViewHandle = ComponentRef<typeof View>;

export type Tone = 'plain' | 'ask' | 'good' | 'miss';

const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

/** Moves a box from `from` to `to`, growing or shrinking on the way. */
export function glide(
  from: Box,
  to: Box,
  ms: number,
  set: (b: Box) => void,
  alive: () => boolean,
): Promise<void> {
  const mix = (a: number, b: number, k: number) => a + (b - a) * k;
  return frames(
    ms,
    (k) => {
      const e = ease(k);
      set({
        x: mix(from.x, to.x, e),
        y: mix(from.y, to.y, e),
        w: mix(from.w, to.w, e),
        h: mix(from.h, to.h, e),
      });
    },
    alive,
  );
}

/** A side-to-side "no" wobble that settles back to 0. */
export function shake(set: (dx: number) => void, alive: () => boolean): Promise<void> {
  return frames(420, (k) => set(Math.sin(k * Math.PI * 6) * 8 * (1 - k)), alive);
}

/**
 * Run tokens for a stage's play-out: `next()` starts a run and `live(t)` says whether it's still
 * the current one. Unmounting ends every run, so a play-out never sets state after it.
 */
export function useRuns() {
  const run = useRef(0);
  useEffect(() => {
    const runs = run;
    return () => {
      runs.current += 1;
    };
  }, []);
  return {
    current: () => run.current,
    next: () => (run.current += 1),
    live: (t: number) => run.current === t,
  };
}

/** A bounce for the stage's centrepiece after a right answer. */
export function useCheer(cheer: boolean | undefined) {
  const [hop] = useState(() => new Animated.Value(0));
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
  return hop.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
}

/** How many screen points one world point takes. Drags divide by it. */
const StageScale = createContext(1);
export const useStageScale = () => useContext(StageScale);

/** A screen point as a world point, for a stage whose box on screen is `rect`. */
export function toWorld(rect: Box, px: number, py: number) {
  const scale = Math.min(rect.w / STAGE_W, rect.h / STAGE_H);
  return {
    x: (px - rect.x - (rect.w - STAGE_W * scale) / 2) / scale,
    y: (py - rect.y - (rect.h - STAGE_H * scale) / 2) / scale,
  };
}

/** Whether a point is over a box, with `slack` world points to spare on every side. */
export const within = (b: Box, p: { x: number; y: number }, slack = 0) =>
  Math.abs(p.x - b.x) <= b.w / 2 + slack && Math.abs(p.y - b.y) <= b.h / 2 + slack;

/** Answers "is this screen point over `spot`?" for a stage drawn in `view`. */
export function hitSpot(view: RefObject<ViewHandle | null>, spot: Box) {
  return (px: number, py: number) =>
    new Promise<boolean>((resolve) => {
      if (!view.current) return resolve(false);
      view.current.measureInWindow((x, y, w, h) =>
        resolve(w > 0 && h > 0 && within(spot, toWorld({ x, y, w, h }, px, py), 14)),
      );
    });
}

/** The 360 × 300 world, centred and scaled into whatever box the stage gets. */
export function StageWorld({
  testID,
  children,
  viewRef,
}: {
  testID: string;
  children: ReactNode;
  viewRef?: RefObject<ViewHandle | null>;
}) {
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: width, h: height });
  };
  const scale = box ? Math.min(box.w / STAGE_W, box.h / STAGE_H) : 0;
  return (
    <View ref={viewRef} style={styles.stage} onLayout={onLayout} testID={testID}>
      {box && scale > 0 && (
        <View
          style={[
            styles.world,
            { left: (box.w - STAGE_W) / 2, top: (box.h - STAGE_H) / 2, transform: [{ scale }] },
          ]}
        >
          <StageScale.Provider value={scale}>{children}</StageScale.Provider>
        </View>
      )}
    </View>
  );
}

const TONES: Record<Tone, { bg: string; border: string; ink: string }> = {
  plain: { bg: colors.raised, border: colors.line, ink: colors.ink },
  ask: { bg: colors.surface, border: colors.accent, ink: colors.softInk },
  good: { bg: colors.good, border: colors.goodInk, ink: colors.goodInk },
  miss: { bg: colors.gentle, border: colors.gentleInk, ink: colors.gentleInk },
};

type CardProps = {
  box: Box;
  text: string;
  emoji?: string;
  tone?: Tone;
  /** A dashed outline, for an empty slot. */
  dashed?: boolean;
  /** Sideways nudge, for a shake. */
  dx?: number;
  testID?: string;
};

/** A word card, with its emoji above the word when tall enough or beside it when not. */
export function CardView({ box, text, emoji, tone = 'plain', dashed, dx = 0, testID }: CardProps) {
  const t = TONES[tone];
  const tall = box.h >= 52;
  // An empty slot's "?" fills it, so the gap stands out from the cards around it.
  const size = dashed
    ? Math.min(30, box.h * 0.6)
    : Math.min(tall ? 15 : 14, Math.max(10, (box.w - 8) / Math.max(4, text.length * 0.55)));
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          left: box.x - box.w / 2 + dx,
          top: box.y - box.h / 2,
          width: box.w,
          height: box.h,
          backgroundColor: t.bg,
          borderColor: t.border,
          flexDirection: tall ? 'column' : 'row',
        },
        dashed && styles.dashed,
      ]}
    >
      {emoji && (
        <Text style={{ fontSize: tall ? Math.min(30, box.h * 0.4) : size + 2 }}>{emoji}</Text>
      )}
      <Text
        numberOfLines={2}
        style={[styles.word, { fontSize: size, lineHeight: size * 1.15, color: t.ink }]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, margin: 8, overflow: 'hidden' },
  world: { position: 'absolute', width: STAGE_W, height: STAGE_H },
  card: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 2,
    borderRadius: radius.sm,
    paddingHorizontal: 3,
  },
  dashed: { borderStyle: 'dashed' },
  word: { ...font.display(700), textAlign: 'center' },
});
