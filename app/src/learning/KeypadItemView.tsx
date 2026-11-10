import type { KeypadItem } from '@bright-trail/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../design/Icon';
import { color, font, pressDown, radius, shadow } from '../design/tokens';
import { ItemFrame, useItemAttempt } from './ItemFrame';
import { ANSWER_PANE_SHARE, colors, formatNumber, MIN_TAP, useLayout } from './theme';
import type { ItemViewProps } from './types';

const MAX_LENGTH = 6;
const GAP = 10;

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
  const { scale, landscape, tablet, width, height } = useLayout();
  const { outcome, answer, replay } = useItemAttempt(props);
  const [entry, setEntry] = useState('');

  // The decimal key only shows up for decimal answers, so young kids never meet it.
  const decimal = !Number.isInteger(item.answer);
  // A landscape phone is too short for five rows, so the display moves beside the keys.
  const compact = landscape && !tablet;
  const rowsTall = compact ? 4 : 5;
  const share = landscape ? 0.85 : 0.55;
  // Keys plus the display (2 keys wide) must fit the answer pane's width too.
  const paneWidth = landscape ? width * ANSWER_PANE_SHARE : width;
  const keysAcross = compact ? 5.5 : 3.3;
  const keySize = Math.max(
    MIN_TAP,
    Math.min(80 * scale, (height * share) / rowsTall - GAP, (paneWidth - 48) / keysAcross),
  );
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

  const keyRadius = { borderRadius: radius.md };
  const display = (
    <View style={styles.displayRow}>
      <View
        accessible
        accessibilityLabel={entry ? `Your answer, ${entry}` : 'Your answer, empty'}
        style={[
          styles.display,
          { minHeight: keySize * 1.3, minWidth: keySize * 2 },
          outcome && (outcome.correct ? styles.good : styles.gentle),
        ]}
      >
        <Text
          style={[
            styles.displayText,
            { fontSize: 56 * scale, lineHeight: 60 * scale },
            !entry && styles.emptyText,
            outcome && { color: outcome.correct ? colors.goodInk : colors.gentleInk },
          ]}
        >
          {entry || '?'}
        </Text>
      </View>
      {outcome && !outcome.correct && (
        <View
          accessible
          accessibilityLabel={`The answer is ${formatNumber(item.answer)}`}
          style={[styles.display, styles.good, { minHeight: keySize * 1.3, minWidth: keySize }]}
        >
          <Text
            style={[
              styles.displayText,
              styles.goodText,
              { fontSize: 56 * scale, lineHeight: 60 * scale },
            ]}
          >
            {formatNumber(item.answer)}
          </Text>
        </View>
      )}
    </View>
  );
  const submitKey = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Check my answer"
      accessibilityState={{ disabled: !canSubmit }}
      disabled={!canSubmit}
      onPress={submit}
      style={({ pressed }) => [
        styles.key,
        styles.submit,
        keyRadius,
        { height: Math.max(MIN_TAP, keySize * 1.1) },
        pressed && pressDown,
        !canSubmit && styles.disabled,
      ]}
    >
      <Icon name="check" size={40 * scale} tint={color.onTrail} stroke={3.2} />
    </Pressable>
  );
  const keys = (
    <View style={[styles.keys, { width: keySize * 3 + GAP * 2 }]}>
      {rows.map((row, r) => (
        <View key={r} style={styles.row}>
          {row.map((key) =>
            key === '' ? (
              <View key="blank" style={{ width: keySize, height: keySize }} />
            ) : (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={key === '⌫' ? 'Delete' : key === '.' ? 'Decimal point' : key}
                onPress={() => setEntry((e) => pressKey(e, key))}
                style={({ pressed }) => [
                  styles.key,
                  keyRadius,
                  { width: keySize, height: keySize },
                  pressed && pressDown,
                ]}
              >
                {key === '⌫' ? (
                  <Icon name="backspace" size={30 * scale} tint={colors.ink} />
                ) : (
                  <Text style={[styles.keyText, { fontSize: 32 * scale }]}>{key}</Text>
                )}
              </Pressable>
            ),
          )}
        </View>
      ))}
      {!compact && submitKey}
    </View>
  );

  return (
    <ItemFrame {...props} replay={replay} outcome={outcome} visual={item.visual}>
      {compact && !outcome ? (
        <View style={styles.side}>
          <View style={styles.sideCol}>
            {display}
            {submitKey}
          </View>
          {keys}
        </View>
      ) : (
        <View style={styles.pad}>
          {display}
          {!outcome && keys}
        </View>
      )}
    </ItemFrame>
  );
}

const styles = StyleSheet.create({
  pad: { alignItems: 'center', gap: 12 },
  side: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  sideCol: { flex: 1, justifyContent: 'center', gap: 12, maxWidth: 260 },
  displayRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  keys: { gap: GAP },
  display: {
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.raised,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayText: { ...font.display(800), color: colors.ink, letterSpacing: 2 },
  emptyText: { color: colors.softInk },
  good: { backgroundColor: colors.good, borderColor: colors.goodInk },
  goodText: { color: colors.goodInk },
  gentle: { backgroundColor: colors.gentle, borderColor: colors.gentleInk },
  row: { flexDirection: 'row', gap: GAP },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow.ledge,
  },
  submit: { alignSelf: 'stretch', backgroundColor: colors.accent, ...shadow.ledgeTrail },
  disabled: { opacity: 0.45, boxShadow: 'none' },
  keyText: { ...font.display(700), color: colors.ink },
});
