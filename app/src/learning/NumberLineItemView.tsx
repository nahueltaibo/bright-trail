import type { NumberLineItem } from '@bright-trail/shared';
import { useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  type AccessibilityActionEvent,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { BigButton } from './controls';
import { ItemFrame, useItemAttempt } from './ItemFrame';
import { indexAtFraction, indexOfValue, labelEvery, stepCount, valueAt } from './numberLine';
import { colors, formatNumber, useLayout } from './theme';
import type { ItemViewProps } from './types';

const MARKER = '🐸';

/**
 * Drag the frog along the line, or tap anywhere on it, and it snaps to the nearest step.
 * Arrow buttons nudge one step for kids who find dragging hard.
 */
export function NumberLineItemView(props: ItemViewProps<NumberLineItem>) {
  const { item } = props;
  const { scale } = useLayout();
  const { outcome, answer, replay } = useItemAttempt(props);
  const [index, setIndex] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  // Page x of the track's left edge, so drag moves don't depend on which view is under the finger.
  const trackLeft = useRef(0);

  const n = stepCount(item);
  const every = labelEvery(n);
  const targetIndex = indexOfValue(item.target, item);
  const markerSize = 56 * scale;
  const pad = markerSize / 2 + 8;
  const usable = Math.max(0, width - pad * 2);
  const xOf = (i: number) => pad + (i / n) * usable;
  const lineY = markerSize + 16;
  const height = lineY + 64 * scale;
  const locked = !!outcome;

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

  const submit = () => {
    if (index === null || locked) return;
    answer(valueAt(index, item), index === targetIndex);
  };

  const ticks = Array.from({ length: n + 1 }, (_, i) => i);
  const placedValue = index === null ? null : formatNumber(valueAt(index, item));

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
                      { left: xOf(i) - 30, top: lineY + 16, fontSize: 18 * scale },
                    ]}
                  >
                    {formatNumber(valueAt(i, item))}
                  </Text>
                )}
              </View>
            );
          })}
          {outcome && !outcome.correct && (
            <View
              testID="number-line-target"
              accessible
              accessibilityLabel={`The answer is ${formatNumber(item.target)}`}
              style={[
                styles.target,
                { left: xOf(targetIndex) - 26 * scale, top: lineY + 12, width: 52 * scale },
              ]}
            >
              <Text style={[styles.targetText, { fontSize: 20 * scale }]}>
                {formatNumber(item.target)}
              </Text>
            </View>
          )}
          <Text
            testID="number-line-marker"
            style={[
              styles.marker,
              {
                fontSize: markerSize * 0.8,
                lineHeight: markerSize,
                width: markerSize,
                left: xOf(index ?? 0) - markerSize / 2,
                top: lineY - markerSize - 6,
              },
              index === null && styles.markerParked,
            ]}
          >
            {MARKER}
          </Text>
        </View>
      </View>
      {!locked && (
        <View style={styles.controls}>
          <BigButton label="Move left" icon="◀" tone="plain" onPress={() => nudge(-1)} />
          <BigButton label="Check my answer" icon="✔" disabled={index === null} onPress={submit} />
          <BigButton label="Move right" icon="▶" tone="plain" onPress={() => nudge(1)} />
        </View>
      )}
    </ItemFrame>
  );
}

const styles = StyleSheet.create({
  track: { alignSelf: 'stretch' },
  noTouch: { pointerEvents: 'none' },
  line: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: colors.ink },
  tick: { position: 'absolute', width: 3, backgroundColor: colors.ink },
  tickMajor: { height: 28 },
  tickMinor: { height: 16, opacity: 0.6 },
  label: { position: 'absolute', width: 60, textAlign: 'center', color: colors.ink },
  target: {
    position: 'absolute',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: colors.good,
    borderWidth: 2,
    borderColor: colors.goodInk,
  },
  targetText: { color: colors.goodInk, fontWeight: '700' },
  marker: { position: 'absolute', textAlign: 'center' },
  // Waiting at the start, faded, until the child places it.
  markerParked: { opacity: 0.45 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
});
