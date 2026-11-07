import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

const MIXED = /^(?:(\d+)\s*)?(?:(\d+)\/(\d+))?$/;

/** "2 1/2" with the fraction stacked, the way kids see it in school. */
export function AmountText({
  label,
  size,
  color = colors.ink,
}: {
  label: string;
  size: number;
  color?: string;
}) {
  const [, whole, num, den] = MIXED.exec(label.trim()) ?? [];
  const small = { fontSize: size * 0.5, lineHeight: size * 0.58, color };
  return (
    <View accessible accessibilityLabel={label} style={[styles.row, { gap: size * 0.12 }]}>
      {whole !== undefined && <Text style={[styles.text, { fontSize: size, color }]}>{whole}</Text>}
      {num !== undefined && (
        <View style={styles.fraction}>
          <Text style={[styles.text, small]}>{num}</Text>
          <View
            style={[styles.bar, { height: Math.max(2, size * 0.06), backgroundColor: color }]}
          />
          <Text style={[styles.text, small]}>{den}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { fontWeight: '700', textAlign: 'center' },
  fraction: { alignItems: 'center' },
  bar: { alignSelf: 'stretch', borderRadius: 2 },
});
