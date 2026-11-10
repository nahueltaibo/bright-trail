import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon, type IconName } from '../../design/Icon';
import { color, font, radius, shadow, TAP_PARENT } from '../../design/tokens';

/** Parent-zone names, mapped onto the design tokens. */
export const colors = {
  background: color.pBg,
  card: color.pSurface,
  sunken: color.pSurfaceSunken,
  border: color.pLine,
  borderStrong: color.pLineStrong,
  text: color.pInk,
  muted: color.pInkMuted,
  primary: color.pPrimary,
  primarySoft: color.pPrimarySoft,
  danger: color.pDanger,
  dangerSoft: color.pDangerSoft,
  ok: color.pOk,
};

/** Tablets get wider side padding and, where a screen asks, two columns. */
export function useWide() {
  const { width } = useWindowDimensions();
  return width >= 900;
}

/** Parent screens share one frame: a back link that names where it goes, a title, and a body. */
export function ParentScreen({
  title,
  children,
  backTo = '/parent',
  backLabel = 'Back',
}: {
  title?: string;
  children: ReactNode;
  /** Where Back goes when there's no history, e.g. after a reload on web. */
  backTo?: '/' | '/parent';
  backLabel?: string;
}) {
  const wide = useWide();
  const side = { paddingHorizontal: wide ? 48 : 20 };
  return (
    <SafeAreaView style={styles.screen}>
      <View style={[styles.header, side]}>
        <BackLink
          label={backLabel}
          onPress={() => (router.canGoBack() ? router.back() : router.replace(backTo))}
        />
        {title && (
          <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Text>
        )}
      </View>
      <ScrollView contentContainerStyle={[styles.body, side]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

export function BackLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={styles.back}
    >
      <Icon name="back" size={22} tint={colors.primary} />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

/** Two columns on a tablet, one stacked column on a phone. */
export function Columns({ left, right }: { left: ReactNode; right: ReactNode }) {
  const wide = useWide();
  if (!wide) {
    return (
      <>
        {left}
        {right}
      </>
    );
  }
  return (
    <View style={styles.cols}>
      <View style={styles.col}>{left}</View>
      <View style={styles.col}>{right}</View>
    </View>
  );
}

/**
 * A titled group on a card, padded for text and forms. Pass `padded={false}` for rows.
 * `plain` drops the card.
 */
export function Section({
  title,
  description,
  action,
  padded = true,
  plain = false,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  padded?: boolean;
  plain?: boolean;
  children: ReactNode;
}) {
  return (
    <View style={styles.section} accessibilityLabel={title}>
      {(title || action) && (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {title}
          </Text>
          {action}
        </View>
      )}
      {description && <Text style={styles.desc}>{description}</Text>}
      {plain ? children : <View style={[styles.card, padded && styles.cardPad]}>{children}</View>}
    </View>
  );
}

/** A list row: optional leading icon or avatar, a title and meta line, and a trailing part. */
export function ParentRow({
  title,
  meta,
  leading,
  trailing,
  chevron = false,
  action = false,
  first = false,
  onPress,
  accessibilityLabel,
}: {
  title: string;
  meta?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  chevron?: boolean;
  /** An add-style row: title in the primary colour. */
  action?: boolean;
  /** The first row in its card has no top divider. */
  first?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const body = (
    <>
      {leading && <View style={styles.rowLead}>{leading}</View>}
      <View style={styles.rowMain}>
        <Text style={[styles.rowTitle, action && { color: colors.primary }]}>{title}</Text>
        {meta && <Text style={styles.rowMeta}>{meta}</Text>}
      </View>
      {trailing}
      {chevron && <Icon name="chevron" size={20} tint={colors.muted} />}
    </>
  );
  const rowStyle = [styles.row, first && styles.rowFirst];
  if (!onPress) return <View style={rowStyle}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [rowStyle, pressed && { backgroundColor: colors.sunken }]}
    >
      {body}
    </Pressable>
  );
}

export function Button({
  label,
  onPress,
  kind = 'primary',
  icon,
  small = false,
  disabled = false,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger' | 'secondary-danger';
  icon?: IconName;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const ink =
    kind === 'primary' || kind === 'danger'
      ? color.onPPrimary
      : kind === 'secondary-danger'
        ? colors.danger
        : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        small && styles.small,
        kind === 'primary' && styles.primary,
        kind === 'danger' && styles.danger,
        (kind === 'secondary' || kind === 'secondary-danger') && styles.secondary,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon && <Icon name={icon} size={20} tint={ink} />}
      <Text style={[styles.buttonText, small && styles.smallText, { color: ink }]}>{label}</Text>
    </Pressable>
  );
}

/** A one-line result under an action. `ok` adds the check and the success colour. */
export function Status({ text, ok = false }: { text: string; ok?: boolean }) {
  return (
    <View style={styles.status} accessibilityLiveRegion="polite">
      {ok && <Icon name="check" size={18} tint={colors.ok} stroke={3} />}
      <Text style={[styles.statusText, ok && styles.statusOk]}>{text}</Text>
    </View>
  );
}

/** Centred icon, title, and body for a section with nothing in it. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: IconName;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} tint={colors.muted} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {body && <Text style={styles.emptyBody}>{body}</Text>}
      {action}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingTop: 8, paddingBottom: 4 },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: TAP_PARENT,
    marginLeft: -6,
    alignSelf: 'flex-start',
    paddingRight: 8,
  },
  backText: { ...font.body(700), fontSize: 15, lineHeight: 20, color: colors.primary },
  title: { ...font.body(700), fontSize: 24, lineHeight: 30, color: colors.text },
  body: { paddingTop: 16, paddingBottom: 32, gap: 24 },
  cols: { flexDirection: 'row', gap: 32, alignItems: 'flex-start' },
  col: { flex: 1, gap: 24, minWidth: 0 },
  section: { gap: 8 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    minHeight: 28,
  },
  sectionTitle: { ...font.body(700), fontSize: 17, lineHeight: 24, color: colors.text },
  desc: { ...font.body(), fontSize: 14, lineHeight: 20, color: colors.muted },
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadow.card,
  },
  cardPad: { padding: 16, gap: 14 },
  text: { ...font.body(), fontSize: 16, lineHeight: 24, color: colors.text },
  muted: { ...font.body(), fontSize: 14, lineHeight: 20, color: colors.muted },
  error: { ...font.body(700), fontSize: 13, lineHeight: 18, color: colors.danger },
  label: { ...font.body(700), fontSize: 14, lineHeight: 20, color: colors.text },
  hint: { ...font.body(), fontSize: 13, lineHeight: 18, color: colors.muted },
  button: {
    flexDirection: 'row',
    gap: 8,
    minHeight: TAP_PARENT,
    paddingHorizontal: 20,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  small: { minHeight: 40, paddingHorizontal: 14, alignSelf: 'flex-start' },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.card, borderColor: colors.borderStrong },
  danger: { backgroundColor: colors.danger },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  buttonText: { ...font.body(700), fontSize: 16, lineHeight: 20 },
  smallText: { fontSize: 14 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  rowFirst: { borderTopWidth: 0 },
  rowLead: { flexShrink: 0 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { ...font.body(700), fontSize: 16, lineHeight: 22, color: colors.text },
  rowMeta: { ...font.body(), fontSize: 13, lineHeight: 18, color: colors.muted },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { ...font.body(), fontSize: 14, lineHeight: 20, color: colors.muted, flexShrink: 1 },
  statusOk: { ...font.body(700), color: colors.ok },
  empty: { alignItems: 'center', gap: 12, paddingVertical: 28, paddingHorizontal: 16 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.sunken,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    ...font.body(700),
    fontSize: 17,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    ...font.body(),
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    maxWidth: 320,
  },
});
