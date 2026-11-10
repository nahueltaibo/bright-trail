import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../../design/Icon';
import { font, radius } from '../../design/tokens';
import { colors, styles as ui } from './ui';

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
      <Text style={ui.label}>{label}</Text>
      <View style={styles.row}>
        {parts.map(({ part, name, shown }) => (
          <View key={part} style={styles.stepper}>
            <StepButton
              label={`Next ${name.toLowerCase()}`}
              up
              onPress={() => onChange(stepDate(value, part, 1, minYear, maxYear))}
            />
            <Text style={styles.value} accessibilityLabel={`${name} ${shown}`}>
              {shown}
            </Text>
            <StepButton
              label={`Previous ${name.toLowerCase()}`}
              up={false}
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
  up = true,
  onPress,
}: {
  label: string;
  up?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.step, pressed && styles.pressed]}
    >
      <View style={{ transform: [{ rotate: up ? '-90deg' : '90deg' }] }}>
        <Icon name="chevron" size={20} tint={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { gap: 6 },
  row: { flexDirection: 'row', gap: 12 },
  stepper: { flex: 1, alignItems: 'center', gap: 4 },
  value: {
    ...font.body(700),
    fontSize: 20,
    lineHeight: 28,
    color: colors.text,
    paddingVertical: 2,
  },
  step: {
    width: '100%',
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: colors.sunken },
});
