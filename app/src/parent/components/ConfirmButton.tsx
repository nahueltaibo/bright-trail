import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IconName } from '../../design/Icon';
import { font, radius } from '../../design/tokens';
import { Button, colors } from './ui';

/**
 * A destructive action that asks once, inline. `Alert.alert` does nothing on web, so the
 * question renders in place instead.
 */
export function ConfirmButton({
  label,
  question,
  consequence,
  confirmLabel,
  icon,
  onConfirm,
}: {
  label: string;
  question: string;
  /** What happens, in full. Shown after the bold question. */
  consequence?: string;
  confirmLabel: string;
  icon?: IconName;
  onConfirm: () => void | Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) {
    return (
      <Button label={label} kind="secondary-danger" icon={icon} onPress={() => setAsking(true)} />
    );
  }

  const confirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
    } finally {
      setBusy(false);
      setAsking(false);
    }
  };

  return (
    <View style={styles.box} accessibilityLabel={label}>
      <Text style={styles.text}>
        <Text style={styles.strong}>{question}</Text>
        {consequence ? ` ${consequence}` : ''}
      </Text>
      <View style={styles.actions}>
        <Button label={confirmLabel} kind="danger" disabled={busy} onPress={confirm} />
        <Button label="Cancel" kind="secondary" onPress={() => setAsking(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    borderWidth: 1.5,
    borderColor: colors.danger,
  },
  text: { ...font.body(), fontSize: 15, lineHeight: 22, color: colors.text },
  strong: { ...font.body(700) },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
