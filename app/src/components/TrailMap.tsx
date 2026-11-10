import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Icon, Star } from '../design/Icon';
import { AvatarDisc } from '../design/kid';
import { color, font, radius, shadow, stateColor } from '../design/tokens';
import { useLayout } from '../learning/theme';
import type { StopState, TrailStop } from '../session/trail';

const STOP_WORDS: Record<StopState, string> = {
  mastered: 'done, it has a star',
  next: 'your next stop',
  review: 'time for a quick review',
  ahead: 'coming up',
  locked: 'not open yet',
};

type Point = [number, number];

/** Stops zig-zag up a meadow in portrait and across it in landscape. Fills its container. */
export function TrailMap({
  stops,
  avatar,
  horizontal = false,
}: {
  stops: readonly TrailStop[];
  avatar: string;
  horizontal?: boolean;
}) {
  const { scale: s } = useLayout();
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width, height });
  };

  const n = stops.length;
  const nextIndex = stops.findIndex((st) => st.state === 'next');
  const cut = nextIndex < 0 ? n - 1 : nextIndex;

  let content = null;
  if (box && n > 0) {
    const { width: w, height: h } = box;
    const pts: Point[] = stops.map((_, i) =>
      horizontal
        ? [((i + 0.5) / n) * w, [0.64, 0.36][i % 2] * h]
        : [[0.5, 0.76, 0.5, 0.24][i % 4] * w, ((n - i - 0.5) / n) * h],
    );
    const seg = (a: Point, b: Point) => {
      if (horizontal) {
        const m = (a[0] + b[0]) / 2;
        return ` C${m} ${a[1]} ${m} ${b[1]} ${b[0]} ${b[1]}`;
      }
      const m = (a[1] + b[1]) / 2;
      return ` C${a[0]} ${m} ${b[0]} ${m} ${b[0]} ${b[1]}`;
    };
    let done = `M${pts[0][0]} ${pts[0][1]}`;
    let ahead = `M${pts[cut][0]} ${pts[cut][1]}`;
    for (let i = 1; i < n; i++) {
      if (i <= cut) done += seg(pts[i - 1], pts[i]);
      else ahead += seg(pts[i - 1], pts[i]);
    }
    content = (
      <>
        <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
          <Path
            d={ahead}
            fill="none"
            stroke={color.kidLineStrong}
            strokeWidth={6 * s}
            strokeLinecap="round"
            strokeDasharray={[0.1, 16 * s]}
            opacity={0.7}
          />
          {cut > 0 && (
            <Path
              d={done}
              fill="none"
              stroke={color.trail}
              strokeWidth={16 * s}
              strokeLinecap="round"
            />
          )}
        </Svg>
        {stops.map((stop, i) => (
          <Stop
            key={i}
            stop={stop}
            index={i}
            at={pts[i]}
            avatar={stop.state === 'next' ? avatar : undefined}
          />
        ))}
      </>
    );
  }

  return (
    <View
      accessibilityRole="list"
      accessibilityLabel="Your trail"
      style={styles.trail}
      onLayout={onLayout}
    >
      {content}
    </View>
  );
}

function Stop({
  stop,
  index,
  at,
  avatar,
}: {
  stop: TrailStop;
  index: number;
  at: Point;
  avatar?: string;
}) {
  const { scale: s } = useLayout();
  const next = stop.state === 'next';
  const side = (next ? 84 : 64) * s;
  const label = `${stop.title ?? `Stop ${index + 1}`}, ${STOP_WORDS[stop.state]}`;

  let inner;
  if (stop.state === 'mastered' || stop.state === 'review') inner = <Star size={40 * s} />;
  else if (next) inner = <Icon name="play" size={34 * s} tint={color.onTrail} />;
  else if (stop.state === 'locked')
    inner = <Icon name="lock" size={24 * s} tint={color.kidInkSoft} />;
  else inner = <Text style={[styles.number, { fontSize: 24 * s }]}>{index + 1}</Text>;

  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.stop,
        { left: at[0] - side / 2, top: at[1] - side / 2, width: side, height: side },
      ]}
    >
      {avatar && (
        <AvatarDisc
          animal={avatar}
          size={52 * s}
          style={[styles.stopAvatar, { bottom: side + 8 * s, left: (side - 52 * s) / 2 }]}
        />
      )}
      <View
        style={[
          styles.stone,
          { width: side, height: side, borderRadius: side / 2 },
          stop.state === 'mastered' && styles.stoneMastered,
          stop.state === 'review' && styles.stoneReview,
          next && [
            styles.stoneNext,
            { boxShadow: `0 0 0 ${10 * s}px ${color.sun}, 0 4px 0 #d98a1f` },
          ],
          stop.state === 'locked' && styles.stoneLocked,
        ]}
      >
        {inner}
        {stop.state === 'review' && (
          <View
            style={[styles.badge, { width: 30 * s, height: 30 * s, top: -10 * s, right: -10 * s }]}
          >
            <Icon name="refresh" size={18 * s} tint={stateColor.review.bg} stroke={3.2} />
          </View>
        )}
      </View>
      {stop.title && (
        <View style={[styles.captionBox, { top: side + (next ? 18 : 10) * s }]}>
          <Text
            numberOfLines={2}
            style={[
              styles.caption,
              {
                fontSize: 15 * s,
                lineHeight: 18 * s,
                paddingHorizontal: 10 * s,
                paddingTop: 3 * s,
                paddingBottom: 1 * s,
              },
            ]}
          >
            {stop.title}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trail: { flex: 1, alignSelf: 'stretch' },
  stop: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  stone: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: color.kidSurfaceRaised,
    borderWidth: 3,
    borderColor: color.kidLineStrong,
    ...shadow.ledge,
  },
  stoneMastered: { borderColor: color.starInk, backgroundColor: color.kidSurface },
  stoneReview: { borderColor: stateColor.review.ink, borderWidth: 4 },
  stoneNext: { backgroundColor: color.trail, borderColor: color.onTrail },
  stoneLocked: { backgroundColor: 'transparent', borderStyle: 'dashed', boxShadow: 'none' },
  number: { ...font.display(800), color: color.kidInkSoft },
  badge: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: stateColor.review.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionBox: {
    position: 'absolute',
    width: 160,
    left: '50%',
    marginLeft: -80,
    alignItems: 'center',
  },
  caption: {
    textAlign: 'center',
    ...font.display(700),
    color: color.kidInk,
    backgroundColor: color.kidBg,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  stopAvatar: { position: 'absolute', boxShadow: `0 0 0 4px ${color.kidBg}` },
});
