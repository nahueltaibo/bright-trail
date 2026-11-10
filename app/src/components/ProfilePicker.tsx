import type { ChildProfile } from '@bright-trail/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { getAvatar } from '../avatars';
import { AvatarDisc } from '../design/kid';
import { color, font, pressDown, radius, shadow } from '../design/tokens';
import { useLayout } from '../learning/theme';
import { Text } from '../design/Text';

type Props = {
  profiles: readonly ChildProfile[];
  onPick: (profile: ChildProfile) => void;
};

/** One big avatar tile per child. The name is a caption for grown-ups, not needed to pick. */
export function ProfilePicker({ profiles, onPick }: Props) {
  const { scale: s } = useLayout();
  return (
    <View style={[styles.grid, { gap: 16 * s }]}>
      {profiles.map((profile) => {
        const avatar = getAvatar(profile.avatar);
        return (
          <Pressable
            key={profile.id}
            accessibilityRole="button"
            accessibilityLabel={`${profile.firstName}, ${avatar.label}`}
            onPress={() => onPick(profile)}
            style={({ pressed }) => [
              styles.tile,
              { gap: 10 * s, padding: 16 * s, paddingBottom: 14 * s },
              pressed && pressDown,
            ]}
          >
            <AvatarDisc animal={avatar.key} size={112 * s} />
            <Text style={[styles.name, { fontSize: 18 * s, lineHeight: 22 * s }]} numberOfLines={1}>
              {profile.firstName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 640,
  },
  tile: {
    alignItems: 'center',
    borderRadius: radius.xl,
    backgroundColor: color.kidSurfaceRaised,
    ...shadow.ledge,
  },
  name: { ...font.display(700), color: color.kidInkSoft, maxWidth: 140 },
});
