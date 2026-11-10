import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAvatar } from '../avatars';
import { useLayout } from '../learning/theme';
import { Icon, Star, type IconName } from './Icon';
import { color, font, pressDown, radius, shadow, TAP_KID } from './tokens';

/** An animal on its tinted disc. Decorative unless given a label. */
export function AvatarDisc({
  animal,
  size,
  label,
  style,
}: {
  animal: string;
  size: number;
  label?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const avatar = getAvatar(animal);
  return (
    <View
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatar.tint },
        style,
      ]}
    >
      <Text style={{ fontSize: size * 0.58, lineHeight: size * 0.75 }}>{avatar.emoji}</Text>
    </View>
  );
}

/**
 * The big pill button. The icon carries the meaning and `label` is spoken. Show the caption
 * only where the icon alone is ambiguous. One `primary` per screen.
 */
export function KidButton({
  label,
  icon,
  onPress,
  variant = 'primary',
  size,
  showLabel = false,
  disabled = false,
  style,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
  variant?: 'primary' | 'plain';
  size?: 'xl';
  showLabel?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { scale: s } = useLayout();
  const xl = size === 'xl';
  const primary = variant === 'primary';
  const ink = primary ? color.onTrail : color.kidInk;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.kbtn,
        {
          minWidth: (xl ? 220 : TAP_KID) * s,
          minHeight: (xl ? 88 : TAP_KID) * s,
          paddingHorizontal: (xl ? 36 : 22) * s,
          gap: 10 * s,
        },
        primary ? styles.kbtnPrimary : styles.kbtnPlain,
        pressed && !disabled && pressDown,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Icon name={icon} size={(xl ? 40 : 32) * s} tint={ink} stroke={3} />
      {showLabel && (
        <Text
          style={[styles.kbtnCap, { color: ink, fontSize: (xl ? 30 : 24) * s }]}
          numberOfLines={1}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

/** Round icon button for the top bar. `quiet` is for grown-up controls a child can ignore. */
export function KidIconButton({
  icon,
  label,
  onPress,
  variant = 'kid',
  busy,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'kid' | 'quiet';
  busy?: boolean;
}) {
  const { scale: s } = useLayout();
  const quiet = variant === 'quiet';
  const side = TAP_KID * s;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={busy === undefined ? undefined : { busy }}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.ibtn,
        { width: side, height: side },
        quiet ? pressed && styles.quietPressed : [styles.ibtnKid, pressed && pressDown],
      ]}
    >
      <Icon
        name={icon}
        size={(quiet ? 24 : 30) * s}
        tint={quiet ? color.kidInkSoft : color.kidInk}
        stroke={quiet ? 2.2 : 2.6}
      />
    </Pressable>
  );
}

/** Where the child is in a story or a check. `steps` draws the bigger question dots. */
export function ProgressDots({
  total,
  current,
  steps = false,
  noun = 'Card',
}: {
  total: number;
  current: number;
  steps?: boolean;
  noun?: string;
}) {
  const { scale: s } = useLayout();
  const d = (steps ? 20 : 12) * s;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`${noun} ${current + 1} of ${total}`}
      style={[styles.dots, { gap: 8 * s }]}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { height: d, width: i === current ? (steps ? 40 : 32) * s : d },
            { borderWidth: steps ? 3 : 2 },
            i < current && styles.dotDone,
            i === current && styles.dotNow,
          ]}
        />
      ))}
    </View>
  );
}

/** The star count, beside Start and on the end screen. Never on an item screen. */
export function StarPill({ count }: { count: number }) {
  const { scale: s } = useLayout();
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={count === 1 ? '1 star' : `${count} stars`}
      style={[
        styles.starPill,
        { gap: 6 * s, paddingVertical: 6 * s, paddingLeft: 8 * s, paddingRight: 14 * s },
      ]}
    >
      <Star size={28 * s} />
      <Text style={[styles.starPillText, { fontSize: 22 * s }]}>{count}</Text>
    </View>
  );
}

/**
 * The skeleton of every kid screen: replay top-left, quiet controls top-right, progress in the
 * middle, then the main area, then at most one primary action at the bottom.
 */
export function KidScreen({
  left,
  mid,
  right,
  bottom,
  spread = false,
  children,
  mainStyle,
  safe = true,
}: {
  left?: ReactNode;
  mid?: ReactNode;
  right?: ReactNode;
  bottom?: ReactNode;
  spread?: boolean;
  children?: ReactNode;
  mainStyle?: StyleProp<ViewStyle>;
  /** Off when a parent screen already applies the safe area. */
  safe?: boolean;
}) {
  const { scale: s, tablet } = useLayout();
  const Root = safe ? SafeAreaView : View;
  return (
    <Root style={styles.screen}>
      <View
        style={[
          styles.frame,
          tablet
            ? { paddingTop: 28, paddingHorizontal: 40, paddingBottom: 32 }
            : { paddingTop: 14 * s, paddingHorizontal: 16 * s, paddingBottom: 20 * s },
          { gap: 12 * s },
        ]}
      >
        <TopRow left={left} mid={mid} right={right} />
        <View style={[styles.main, { gap: 22 * s }, mainStyle]}>{children}</View>
        {bottom && (
          <View style={[styles.bottom, { gap: 16 * s }, spread && styles.bottomSpread]}>
            {bottom}
          </View>
        )}
      </View>
    </Root>
  );
}

export function TopRow({
  left,
  mid,
  right,
}: {
  left?: ReactNode;
  mid?: ReactNode;
  right?: ReactNode;
}) {
  const { scale: s } = useLayout();
  const side = { minWidth: TAP_KID * s, gap: 8 * s };
  return (
    <View style={[styles.top, { minHeight: TAP_KID * s }]}>
      <View style={[styles.topSide, side]}>{left}</View>
      <View style={[styles.topMid, { gap: 12 * s }]}>{mid}</View>
      <View style={[styles.topSide, styles.topRight, side]}>{right}</View>
    </View>
  );
}

/** Kid type styles, scaled for tablets. */
export function useKidType() {
  const { scale: s } = useLayout();
  return {
    hero: [styles.hero, { fontSize: 40 * s, lineHeight: 44 * s }] as StyleProp<TextStyle>,
    prompt: [styles.prompt, { fontSize: 28 * s, lineHeight: 34 * s }] as StyleProp<TextStyle>,
    lede: [styles.lede, { fontSize: 20 * s, lineHeight: 28 * s }] as StyleProp<TextStyle>,
  };
}

/** A big round picture behind end and pause screens. */
export function ArtDisc({
  icon,
  tint = color.kidInk,
  background = color.kidSurface,
}: {
  icon: IconName;
  tint?: string;
  background?: string;
}) {
  const { scale: s } = useLayout();
  const side = 180 * s;
  return (
    <View
      style={[
        styles.art,
        { width: side, height: side, borderRadius: side / 2, backgroundColor: background },
      ]}
    >
      <Icon name={icon} size={96 * s} tint={tint} stroke={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.kidBg },
  frame: { flex: 1 },
  disc: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  kbtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  kbtnPrimary: { backgroundColor: color.trail, ...shadow.ledgeTrail },
  kbtnPlain: {
    backgroundColor: color.kidSurfaceRaised,
    borderWidth: 2,
    borderColor: color.kidLineStrong,
    ...shadow.ledge,
  },
  kbtnCap: { ...font.display(800), paddingTop: 2 },
  disabled: { opacity: 0.4, boxShadow: 'none' },
  ibtn: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  ibtnKid: { backgroundColor: color.kidSurface, ...shadow.ledge },
  quietPressed: { backgroundColor: color.kidSurface },
  dots: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  dot: { borderRadius: radius.pill, borderColor: color.kidLineStrong },
  dotDone: { backgroundColor: color.kidLineStrong },
  dotNow: { backgroundColor: color.trailDeep, borderColor: color.trailDeep },
  starPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: color.kidSurface,
  },
  starPillText: { ...font.display(800), color: color.kidInk },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  topSide: { flexDirection: 'row' },
  topRight: { justifyContent: 'flex-end' },
  topMid: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
  },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  bottom: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  bottomSpread: { justifyContent: 'space-between' },
  hero: { ...font.display(800), color: color.kidInk, textAlign: 'center' },
  prompt: { ...font.display(700), color: color.kidInk, textAlign: 'center' },
  lede: { ...font.body(), color: color.kidInkSoft, textAlign: 'center', maxWidth: 340 },
  art: { alignItems: 'center', justifyContent: 'center' },
});
