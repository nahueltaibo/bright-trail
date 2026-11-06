import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from './ui';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n: number) => String(n).padStart(2, '0');
const daysIn = (year: number, month: number) => new Date(Date.UTC(year, month, 0)).getUTCDate();

/**
 * Moves one part of a `YYYY-MM-DD` date, keeping the year within `[minYear, maxYear]` and the
 * day within the month. Months and days wrap around.
 */
export function stepDate(
  date: string,
  part: 'year' | 'month' | 'day',
  delta: number,
  minYear: number,
  maxYear: number,
): string {
  let [year, month, day] = date.split('-').map(Number);
  if (part === 'year') year = Math.min(Math.max(year + delta, minYear), maxYear);
  if (part === 'month') month = ((month - 1 + delta + 12) % 12) + 1;
  if (part === 'day') {
    const max = daysIn(year, month);
    day = ((day - 1 + delta + max) % max) + 1;
  }
  day = Math.min(day, daysIn(year, month));
  return `${year}-${pad(month)}-${pad(day)}`;
}

/** Three steppers instead of a native picker, so it works the same on phone, tablet, and web. */
export function DateField({
  label,
  value,
  onChange,
  minYear,
  maxYear,
}: {
  label: string;
  value: string;
  onChange: (date: string) => void;
  minYear: number;
  maxYear: number;
}) {
  const [year, month, day] = value.split('-').map(Number);
  const parts = [
    { part: 'day', name: 'Day', shown: String(day) },
    { part: 'month', name: 'Month', shown: MONTHS[month - 1] },
    { part: 'year', name: 'Year', shown: String(year) },
  ] as const;

  return (
    <View style={styles.box}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {parts.map(({ part, name, shown }) => (
          <View key={part} style={styles.stepper}>
            <StepButton
              label={`Next ${name.toLowerCase()}`}
              symbol="▲"
              onPress={() => onChange(stepDate(value, part, 1, minYear, maxYear))}
            />
            <Text style={styles.value} accessibilityLabel={`${name} ${shown}`}>
              {shown}
            </Text>
            <StepButton
              label={`Previous ${name.toLowerCase()}`}
              symbol="▼"
              onPress={() => onChange(stepDate(value, part, -1, minYear, maxYear))}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

function StepButton({
  label,
  symbol,
  onPress,
}: {
  label: string;
  symbol: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <Text style={styles.stepText}>{symbol}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { gap: 8 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  row: { flexDirection: 'row', gap: 12 },
  stepper: { flex: 1, alignItems: 'center', gap: 4 },
  value: { fontSize: 22, color: colors.text, paddingVertical: 4 },
  step: {
    width: '100%',
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: '#E9ECF2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: '#CDD3DE' },
  stepText: { fontSize: 16, color: colors.text },
});
