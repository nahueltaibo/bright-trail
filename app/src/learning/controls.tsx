import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, MIN_TAP, useLayout } from './theme';

type BigButtonProps = {
  label: string;
  /** Emoji or short text drawn on the button. The label is what screen readers say. */
  icon: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'primary' | 'plain';
  size?: number;
  style?: StyleProp<ViewStyle>;
};

export function BigButton({
  label,
  icon,
  onPress,
  disabled,
  tone = 'primary',
  size,
  style,
}: BigButtonProps) {
  const { scale } = useLayout();
  const side = Math.max(size ?? 80 * scale, MIN_TAP);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        { minWidth: side, height: side, borderRadius: side / 2.5 },
        tone === 'primary' ? styles.primary : styles.plain,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.bigIcon, { fontSize: side * 0.45, lineHeight: side * 0.6 }]}>
        {icon}
      </Text>
    </Pressable>
  );
}

function IconButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.icon, pressed && styles.pressed]}
    >
      <Text style={styles.iconText}>{icon}</Text>
    </Pressable>
  );
}

/** Speaker button. Replays the last narration. */
export function ReplayButton({ onPress }: { onPress: () => void }) {
  return <IconButton label="Say it again" icon="🔊" onPress={onPress} />;
}

/** "This looks wrong". Turns into a thank-you so one card can't be flagged twice by accident. */
export function FlagButton({ onFlag }: { onFlag?: () => void }) {
  const [flagged, setFlagged] = useState(false);
  return (
    <View style={flagged ? undefined : styles.quiet}>
      <IconButton
        label={flagged ? 'Thanks for telling us' : 'This looks wrong'}
        icon={flagged ? '💌' : '🚩'}
        disabled={flagged}
        onPress={() => {
          setFlagged(true);
          onFlag?.();
        }}
      />
    </View>
  );
}

/** Replay on the left, flag on the right. */
export function TopBar({ left, right }: { left: ReactNode; right: ReactNode }) {
  return (
    <View style={styles.topBar}>
      {left}
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  big: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primary: { backgroundColor: colors.accent },
  plain: { backgroundColor: colors.surface },
  pressed: { transform: [{ scale: 0.95 }], opacity: 0.85 },
  disabled: { opacity: 0.35 },
  bigIcon: { color: colors.ink, textAlign: 'center' },
  icon: {
    width: MIN_TAP,
    height: MIN_TAP,
    borderRadius: MIN_TAP / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  iconText: { fontSize: 30, lineHeight: 38 },
  // The flag is for grown-ups and older kids, so it sits back a little.
  quiet: { opacity: 0.7 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
