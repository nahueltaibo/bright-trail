import type { MasteryStatus } from '@bright-trail/shared';
import { StyleSheet, Text, View } from 'react-native';
import { LEGEND_ORDER, STATE_STYLES } from '../skillTree';

export function StateBadge({ state }: { state: MasteryStatus }) {
  const s = STATE_STYLES[state];
  return (
    <View style={[styles.badge, { backgroundColor: s.color }]}>
      <Text style={[styles.text, { color: s.text }]}>{s.label}</Text>
    </View>
  );
}

export function StateLegend() {
  return (
    <View style={styles.legend} accessibilityLabel="Legend">
      {LEGEND_ORDER.map((state) => (
        <StateBadge key={state} state={state} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  text: { fontSize: 13, fontWeight: '600' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
