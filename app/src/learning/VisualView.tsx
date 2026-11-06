import type { Visual } from '@bright-trail/shared';
import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { colors } from './theme';

const FRAME_BORDER = 2;

type Props = {
  visual: Visual;
  /** Box the picture must fit inside. */
  width: number;
  height: number;
};

/** Short description for screen readers. */
export function describeVisual(visual: Visual): string {
  switch (visual.kind) {
    case 'emoji':
      return visual.emoji;
    case 'objects':
      return `${visual.count} ${visual.emoji}`;
    case 'ten-frame':
      return `Ten frame with ${visual.filled} filled`;
  }
}

/** Draws a visual from data. Objects come in rows of five, like a ten-frame, to help counting. */
export function VisualView({ visual, width, height }: Props) {
  const label = describeVisual(visual);

  if (visual.kind === 'emoji') {
    const size = Math.min(width, height) * 0.8;
    return (
      <View accessible accessibilityRole="image" accessibilityLabel={label}>
        <Text style={[styles.emoji, { fontSize: size, lineHeight: size * 1.2 }]}>
          {visual.emoji}
        </Text>
      </View>
    );
  }

  if (visual.kind === 'objects') {
    const cols = Math.min(visual.count, 5);
    const rows = Math.ceil(visual.count / 5);
    const cell = Math.min(width / cols, height / rows, Math.min(width, height) / 2);
    const fontSize = cell * 0.72;
    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={label}
        style={[styles.grid, { width: cell * cols }]}
      >
        {Array.from({ length: visual.count }, (_, i) => (
          <View key={i} style={[styles.cell, { width: cell, height: cell }]}>
            <Text style={[styles.emoji, { fontSize, lineHeight: fontSize * 1.2 }]}>
              {visual.emoji}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const cell = Math.min((width - FRAME_BORDER * 2) / 5, (height - FRAME_BORDER * 2) / 2);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.frame, { width: cell * 5 + FRAME_BORDER * 2 }]}
    >
      {Array.from({ length: 10 }, (_, i) => (
        <View key={i} style={[styles.frameCell, { width: cell, height: cell }]}>
          {i < visual.filled && (
            <View
              testID="ten-frame-dot"
              style={[
                styles.dot,
                { width: cell * 0.7, height: cell * 0.7, borderRadius: cell * 0.35 },
              ]}
            />
          )}
        </View>
      ))}
    </View>
  );
}

/** Fills the space it's given and sizes the visual to fit, so layouts don't hard-code sizes. */
export function FitVisual({ visual, maxSize = 420 }: { visual: Visual; maxSize?: number }) {
  const [box, setBox] = useState<{ width: number; height: number } | null>(null);
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ width: Math.min(width, maxSize), height: Math.min(height, maxSize) });
  };
  // Draw at a guess until measured, hidden, so the first frame doesn't overflow.
  const size = box ?? { width: 160, height: 160 };
  return (
    <View style={styles.fit} onLayout={onLayout}>
      <View style={!box && styles.hidden}>
        <VisualView visual={visual} width={size.width} height={size.height} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emoji: { textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cell: { alignItems: 'center', justifyContent: 'center' },
  frame: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: FRAME_BORDER,
    borderColor: colors.ink,
    backgroundColor: '#FFFFFF',
  },
  frameCell: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
  },
  dot: { backgroundColor: colors.dot },
  fit: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
});
