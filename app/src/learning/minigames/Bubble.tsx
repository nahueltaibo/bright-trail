import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text } from 'react-native';
import { colors } from '../theme';
import { font } from '../../design/tokens';

const NATIVE = Platform.OS !== 'web';

export type Bubble = { id: number; x: number; y: number; text: string; big?: boolean };

/** A count or a sum that pops up over the stage, centered on (x, y). */
export function BubbleView({ bubble: b }: { bubble: Bubble }) {
  const [pop] = useState(() => new Animated.Value(0.3));
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: NATIVE, friction: 5 }).start();
  }, [pop]);
  const size = b.big ? 20 : 16;
  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.bubble, { left: b.x - 120, top: b.y - size, transform: [{ scale: pop }] }]}
    >
      <Text style={[styles.text, b.big && styles.bigText, { fontSize: size }]}>{b.text}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bubble: { position: 'absolute', width: 240, alignItems: 'center' },
  text: {
    ...font.display(800),
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
});
