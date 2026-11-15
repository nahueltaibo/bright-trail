import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { font } from '../../design/tokens';
import { Text } from '../../design/Text';

const NATIVE = Platform.OS !== 'web';

export type Bubble = {
  id: number;
  x: number;
  y: number;
  text: string;
  big?: boolean;
  /** Fades the bubble out. */
  out?: boolean;
};

/** A count or a sum that pops up over the stage, centered on (x, y). */
export function BubbleView({ bubble: b }: { bubble: Bubble }) {
  const [pop] = useState(() => new Animated.Value(0.3));
  const [shown] = useState(() => new Animated.Value(1));
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: NATIVE, friction: 5 }).start();
  }, [pop]);
  useEffect(() => {
    if (!b.out) return;
    const fade = Animated.timing(shown, { toValue: 0, duration: 300, useNativeDriver: NATIVE });
    fade.start();
    return () => fade.stop();
  }, [b.out, shown]);
  const size = b.big ? 20 : 16;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bubble,
        { left: b.x - 120, top: b.y - size, transform: [{ scale: pop }], opacity: shown },
      ]}
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
