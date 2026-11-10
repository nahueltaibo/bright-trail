import type { MasteryStatus } from '@bright-trail/shared';
import { StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../design/Icon';
import { font, radius, stateColor } from '../../design/tokens';
import { LEGEND_ORDER, STATE_STYLES } from '../skillTree';
import { colors } from './ui';

const INK: Record<MasteryStatus, { ink: string; bg: string }> = {
  unknown: stateColor.unknown,
  assumed: stateColor.assumed,
  gap: stateColor.gap,
  learning: stateColor.learning,
  mastered: stateColor.mastered,
  'review-due': stateColor.review,
};

/** A skill state as icon, word, and border. `compact` keeps the icon and speaks the word. */
export function StateBadge({
  state,
  compact = false,
}: {
  state: MasteryStatus;
  compact?: boolean;
}) {
  const s = STATE_STYLES[state];
  const { ink, bg } = INK[state];
  return (
    <View
      accessible
      accessibilityLabel={s.label}
      style={[
        styles.badge,
        compact && styles.compact,
        {
          backgroundColor: bg,
          borderColor: ink,
          borderStyle: s.border === 'thick' ? 'solid' : s.border,
          borderWidth: s.border === 'thick' ? 2.5 : s.border === 'dotted' ? 2 : 1.5,
        },
      ]}
    >
      <Icon name={s.icon} size={16} tint={ink} />
      {!compact && <Text style={[styles.text, { color: ink }]}>{s.label}</Text>}
    </View>
  );
}

/** Every state with what it means. */
export function StateLegend() {
  return (
    <View style={styles.legend} accessibilityLabel="Legend">
      {LEGEND_ORDER.map((state) => (
        <View key={state} style={styles.legendRow}>
          <View style={styles.legendBadge}>
            <StateBadge state={state} />
          </View>
          <Text style={styles.meaning}>{STATE_STYLES[state].meaning}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 6,
    paddingRight: 10,
    minHeight: 26,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  compact: { width: 26, paddingLeft: 0, paddingRight: 0, justifyContent: 'center' },
  text: { ...font.body(700), fontSize: 13, lineHeight: 18 },
  legend: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  legendBadge: { width: 120 },
  meaning: { ...font.body(), flex: 1, fontSize: 14, lineHeight: 20, color: colors.muted },
});
