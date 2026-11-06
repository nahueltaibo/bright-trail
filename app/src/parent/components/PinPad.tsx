import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PIN_LENGTH } from '../pin';
import { colors } from './ui';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'] as const;

/** Digit keypad with PIN dots. Calls `onComplete` once all digits are in, then clears. */
export function PinPad({
  title,
  message,
  error,
  onComplete,
}: {
  title: string;
  message?: string;
  error?: string | null;
  onComplete: (pin: string) => void;
}) {
  const [pin, setPin] = useState('');

  const press = (key: (typeof KEYS)[number]) => {
    if (key === 'del') return setPin((p) => p.slice(0, -1));
    const next = pin + key;
    if (next.length < PIN_LENGTH) return setPin(next);
    setPin('');
    onComplete(next);
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      {message && <Text style={styles.message}>{message}</Text>}
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`${pin.length} of ${PIN_LENGTH} digits entered`}
      >
        {Array.from({ length: PIN_LENGTH }, (_, i) => (
          <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
        ))}
      </View>
      <Text style={styles.error} accessibilityLiveRegion="polite">
        {error ?? ' '}
      </Text>
      <View style={styles.grid}>
        {KEYS.map((key, i) =>
          key === '' ? (
            <View key={i} style={styles.key} />
          ) : (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={key === 'del' ? 'Delete digit' : key}
              onPress={() => press(key)}
              style={({ pressed }) => [styles.key, styles.keyButton, pressed && styles.pressed]}
            >
              <Text style={styles.keyText}>{key === 'del' ? '⌫' : key}</Text>
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const KEY_SIZE = 72;

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 12 },
  title: { fontSize: 24, fontWeight: '600', color: colors.text, textAlign: 'center' },
  message: { fontSize: 16, color: colors.muted, textAlign: 'center', maxWidth: 320 },
  dots: { flexDirection: 'row', gap: 16, marginTop: 8 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.text },
  dotFilled: { backgroundColor: colors.text },
  error: { fontSize: 15, color: colors.danger, minHeight: 20 },
  grid: { width: KEY_SIZE * 3 + 32, flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  key: { width: KEY_SIZE, height: KEY_SIZE },
  keyButton: {
    borderRadius: KEY_SIZE / 2,
    backgroundColor: '#E9ECF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: '#CDD3DE' },
  keyText: { fontSize: 28, color: colors.text },
});
