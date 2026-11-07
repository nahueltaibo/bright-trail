import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, styles as ui } from './ui';

/**
 * A destructive action that asks once, inline. `Alert.alert` does nothing on web, so the
 * question renders in place instead.
 */
export function ConfirmButton({
  label,
  question,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!asking) return <Button label={label} kind="secondary" onPress={() => setAsking(true)} />;

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
    <View style={styles.box}>
      <Text style={ui.text}>{question}</Text>
      <View style={styles.actions}>
        <Button
          label="Cancel"
          kind="secondary"
          onPress={() => setAsking(false)}
          style={styles.flex}
        />
        <Button
          label={confirmLabel}
          kind="danger"
          disabled={busy}
          onPress={confirm}
          style={styles.flex}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: 12, padding: 12, borderRadius: 10, backgroundColor: '#FDECEA' },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
