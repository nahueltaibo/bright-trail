import type { ChildProfile } from '@bright-trail/shared';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getAvatar } from '../avatars';

type Props = {
  profiles: readonly ChildProfile[];
  onPick: (profile: ChildProfile) => void;
};

/** One big avatar button per child. The name is a caption for grown-ups, not needed to pick. */
export function ProfilePicker({ profiles, onPick }: Props) {
  return (
    <View style={styles.grid}>
      {profiles.map((profile) => {
        const avatar = getAvatar(profile.avatar);
        return (
          <Pressable
            key={profile.id}
            accessibilityRole="button"
            accessibilityLabel={`${profile.firstName}, ${avatar.label}`}
            onPress={() => onPick(profile)}
            style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
          >
            <Text style={styles.emoji}>{avatar.emoji}</Text>
            <Text style={styles.name} numberOfLines={1}>
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
    gap: 24,
  },
  tile: {
    width: 160,
    height: 180,
    borderRadius: 32,
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  pressed: {
    transform: [{ scale: 0.95 }],
    backgroundColor: '#FFE7A3',
  },
  emoji: {
    fontSize: 88,
  },
  name: {
    fontSize: 20,
    color: '#5A4A1F',
  },
});
