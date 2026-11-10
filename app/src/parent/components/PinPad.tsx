import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../design/Icon';
import { font, shadow } from '../../design/tokens';
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
          <View
            key={i}
            style={[styles.dot, error && styles.dotError, i < pin.length && styles.dotFilled]}
          />
        ))}
      </View>
      <View style={styles.errorRow} accessibilityLiveRegion="polite">
        {error && <Icon name="alert" size={16} tint={colors.danger} />}
        <Text style={styles.error}>{error ?? ' '}</Text>
      </View>
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
              style={({ pressed }) => [
                styles.key,
                key === 'del' ? styles.ghost : styles.keyButton,
                pressed && styles.pressed,
              ]}
            >
              {key === 'del' ? (
                <Icon name="backspace" size={26} tint={colors.text} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </Pressable>
          ),
        )}
      </View>
    </View>
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  box: { alignItems: 'center', gap: 14, width: '100%', maxWidth: 340 },
  title: {
    ...font.body(700),
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    ...font.body(),
    fontSize: 15,
    lineHeight: 22,
    color: colors.muted,
    textAlign: 'center',
  },
  dots: { flexDirection: 'row', gap: 18, paddingTop: 10, paddingBottom: 2 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.text },
  dotError: { borderColor: colors.danger },
  dotFilled: { backgroundColor: colors.text },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 20 },
  error: { ...font.body(700), fontSize: 14, lineHeight: 20, color: colors.danger },
  grid: {
    width: KEY_SIZE * 3 + 44,
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 22,
    rowGap: 14,
  },
  key: {
    width: KEY_SIZE,
    height: KEY_SIZE,
    borderRadius: KEY_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  ghost: { backgroundColor: 'transparent' },
  pressed: { backgroundColor: colors.sunken },
  keyText: { ...font.body(), fontSize: 28, color: colors.text },
});
