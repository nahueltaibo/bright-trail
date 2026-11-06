import type { KeypadItem } from '@bright-trail/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ItemFrame, useItemAttempt } from './ItemFrame';
import { colors, formatNumber, MIN_TAP, useLayout } from './theme';
import type { ItemViewProps } from './types';

const MAX_LENGTH = 6;

/** Keypad answers count as right within floating-point noise, so 0.1 + 0.2 still matches 0.3. */
export function isKeypadCorrect(entry: string, answer: number): boolean {
  const value = Number(entry);
  return entry !== '' && Number.isFinite(value) && Math.abs(value - answer) < 1e-9;
}

/** Next entry after a key press, or the same entry when the key doesn't fit. */
export function pressKey(entry: string, key: string): string {
  if (key === '⌫') return entry.slice(0, -1);
  if (entry.length >= MAX_LENGTH) return entry;
  if (key === '.') return entry.includes('.') ? entry : (entry || '0') + '.';
  // No leading zeros: "07" reads as 7 to the child but looks odd.
  if (entry === '0') return key;
  return entry + key;
}

/** Type a number on big keys, then tap the check mark. */
export function KeypadItemView(props: ItemViewProps<KeypadItem>) {
  const { item } = props;
  const { scale, landscape, tablet } = useLayout();
  const { outcome, answer, replay } = useItemAttempt(props);
  const [entry, setEntry] = useState('');

  // The decimal key only shows up for decimal answers, so young kids never meet it.
  const decimal = !Number.isInteger(item.answer);
  const keySize = Math.max(MIN_TAP, (landscape && !tablet ? 64 : 80) * scale);
  const rows = [
    ['1', '2', '3'],
    ['4', '5', '6'],
    ['7', '8', '9'],
    [decimal ? '.' : '', '0', '⌫'],
  ];
  const canSubmit = entry !== '' && entry !== '0.' && !outcome;
  const submit = () => {
    if (canSubmit) answer(Number(entry), isKeypadCorrect(entry, item.answer));
  };

  return (
    <ItemFrame {...props} replay={replay} outcome={outcome} visual={item.visual}>
      <View style={styles.pad}>
        <View style={styles.displayRow}>
          <View
            accessible
            accessibilityLabel={entry ? `Your answer, ${entry}` : 'Your answer, empty'}
            style={[
              styles.display,
              { height: keySize, minWidth: keySize * 2.5 },
              outcome && (outcome.correct ? styles.good : styles.gentle),
            ]}
          >
            <Text style={[styles.displayText, { fontSize: keySize * 0.55 }]}>{entry || ' '}</Text>
          </View>
          {outcome && !outcome.correct && (
            <View
              accessible
              accessibilityLabel={`The answer is ${formatNumber(item.answer)}`}
              style={[styles.display, styles.good, { height: keySize }]}
            >
              <Text style={[styles.displayText, styles.goodText, { fontSize: keySize * 0.55 }]}>
                {formatNumber(item.answer)}
              </Text>
            </View>
          )}
          {!outcome && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check my answer"
              accessibilityState={{ disabled: !canSubmit }}
              disabled={!canSubmit}
              onPress={submit}
              style={({ pressed }) => [
                styles.key,
                styles.submit,
                { width: keySize, height: keySize, borderRadius: keySize / 2.5 },
                pressed && styles.pressed,
                !canSubmit && styles.disabled,
              ]}
            >
              <Text style={[styles.keyText, { fontSize: keySize * 0.5 }]}>✔</Text>
            </Pressable>
          )}
        </View>
        {!outcome &&
          rows.map((row, r) => (
            <View key={r} style={styles.row}>
              {row.map((key, k) =>
                key === '' ? (
                  <View key={k} style={{ width: keySize, height: keySize }} />
                ) : (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={
                      key === '⌫' ? 'Delete' : key === '.' ? 'Decimal point' : key
                    }
                    onPress={() => setEntry((e) => pressKey(e, key))}
                    style={({ pressed }) => [
                      styles.key,
                      { width: keySize, height: keySize, borderRadius: keySize / 2.5 },
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={[styles.keyText, { fontSize: keySize * 0.5 }]}>{key}</Text>
                  </Pressable>
                ),
              )}
            </View>
          ))}
      </View>
    </ItemFrame>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: 8 },
  displayRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  display: {
    borderRadius: 20,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayText: { color: colors.ink, fontWeight: '700' },
  good: { backgroundColor: colors.good, borderColor: colors.goodInk },
  goodText: { color: colors.goodInk },
  gentle: { backgroundColor: colors.gentle, borderColor: colors.gentleInk },
  row: { flexDirection: 'row', gap: 8 },
  key: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  submit: { backgroundColor: colors.accent },
  pressed: { transform: [{ scale: 0.94 }], backgroundColor: colors.pressed },
  disabled: { opacity: 0.35 },
  keyText: { color: colors.ink, fontWeight: '700' },
});
