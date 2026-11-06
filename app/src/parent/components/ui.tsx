import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  background: '#F7F8FA',
  card: '#FFFFFF',
  border: '#DADDE3',
  text: '#1D2433',
  muted: '#5B6475',
  primary: '#2F5BD3',
  danger: '#B3261E',
};

/** Parent screens share one frame: a back link, a title, and a scrolling body. */
export function ParentScreen({
  title,
  children,
  backTo = '/parent',
  backLabel = 'Back',
}: {
  title: string;
  children: ReactNode;
  /** Where Back goes when there's no history, e.g. after a reload on web. */
  backTo?: '/' | '/parent';
  backLabel?: string;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo))}
        >
          <Text style={styles.back}>‹ {backLabel}</Text>
        </Pressable>
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      {title && <Text style={styles.sectionTitle}>{title}</Text>}
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[kind],
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.buttonText, kind === 'secondary' && styles.secondaryText]}>{label}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 4 },
  back: { fontSize: 17, color: colors.primary, paddingVertical: 6 },
  title: { fontSize: 26, fontWeight: '600', color: colors.text },
  body: { padding: 16, gap: 16, paddingBottom: 48 },
  section: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: colors.text },
  text: { fontSize: 16, color: colors.text },
  muted: { fontSize: 14, color: colors.muted },
  error: { fontSize: 15, color: colors.danger },
  button: {
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
  buttonText: { fontSize: 17, fontWeight: '600', color: '#fff' },
  secondaryText: { color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
