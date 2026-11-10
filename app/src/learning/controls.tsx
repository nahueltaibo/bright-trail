import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon } from '../design/Icon';
import { KidIconButton } from '../design/kid';
import { color, font, TAP_KID } from '../design/tokens';
import { useLayout } from './theme';
import { Text } from '../design/Text';

export { KidButton, TopRow as TopBar } from '../design/kid';

/** Speaker button. Replays the last narration. */
export function ReplayButton({ onPress }: { onPress: () => void }) {
  return <KidIconButton icon="speaker" label="Say it again" onPress={onPress} />;
}

/** "This looks wrong". Turns into a thank-you so one card can't be flagged twice by accident. */
export function FlagButton({ onFlag }: { onFlag?: () => void }) {
  const { scale: s } = useLayout();
  const [flagged, setFlagged] = useState(false);
  if (flagged) {
    return (
      <View
        accessible
        accessibilityLabel="Thanks for telling us"
        accessibilityState={{ disabled: true }}
        accessibilityRole="text"
        style={[styles.thanks, { minHeight: TAP_KID * s, paddingHorizontal: 8 * s }]}
      >
        <Icon name="check" size={18 * s} tint={color.kidInkSoft} stroke={3} />
        <Text style={[styles.thanksText, { fontSize: 14 * s }]}>Thanks for telling us</Text>
      </View>
    );
  }
  return (
    <KidIconButton
      icon="flag"
      label="This looks wrong"
      variant="quiet"
      onPress={() => {
        setFlagged(true);
        onFlag?.();
      }}
    />
  );
}

const styles = StyleSheet.create({
  thanks: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 150 },
  thanksText: { ...font.body(700), color: color.kidInkSoft, flexShrink: 1 },
});
