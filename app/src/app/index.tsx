import type { ChildProfile } from '@bright-trail/shared';
import { Link, router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ProfilePicker } from '../components/ProfilePicker';
import { Icon } from '../design/Icon';
import { KidIconButton, KidScreen, useKidType } from '../design/kid';
import { color } from '../design/tokens';
import { SHOW_DEV_TOOLS } from '../devTools';
import { useLayout } from '../learning/theme';
import { SpeakerButton, useAutoNarration } from '../narration';
import { useStorage } from '../storage/StorageProvider';
import { Text } from '../design/Text';

const EMPTY_MESSAGE = 'Ask a grown-up to add you.';
const PICK_MESSAGE = 'Who’s playing? Tap your picture.';

const DEV_LINKS: { href: Href; label: string }[] = [
  { href: '/dev/learning', label: 'Dev: learning preview' },
  { href: '/dev/share', label: 'Dev: sharing minigame' },
  { href: '/dev/slices', label: 'Dev: slices minigame' },
  { href: '/dev/join', label: 'Dev: join and leave minigame' },
  { href: '/dev/hops', label: 'Dev: frog hops' },
  { href: '/dev/check-end', label: 'Dev: check-end screens' },
];

/** Kid home: pick who's playing. */
export default function ProfilePickerScreen() {
  const repo = useStorage();
  const type = useKidType();
  const { scale: s } = useLayout();
  const [profiles, setProfiles] = useState<ChildProfile[] | null>(null);

  const reload = useCallback(() => {
    repo.children.list().then(setProfiles);
  }, [repo]);

  // Reload on focus so children added in the parent area show up on return.
  useFocusEffect(reload);

  const message = profiles === null ? null : profiles.length > 0 ? PICK_MESSAGE : EMPTY_MESSAGE;
  useAutoNarration(message);

  const empty = 128 * s;
  return (
    <KidScreen
      left={message && <SpeakerButton text={message} />}
      right={
        <KidIconButton
          icon="lock"
          label="Parent area"
          variant="quiet"
          onPress={() => router.push('/parent')}
        />
      }
      bottom={
        SHOW_DEV_TOOLS && (
          <View style={styles.dev}>
            {DEV_LINKS.map((d) => (
              <Link key={d.label} href={d.href} asChild>
                <Pressable accessibilityRole="button" style={styles.devButton}>
                  <Text style={styles.devText}>{d.label}</Text>
                </Pressable>
              </Link>
            ))}
          </View>
        )
      }
    >
      {profiles && profiles.length > 0 && (
        <>
          <Text accessibilityRole="header" style={type.prompt}>
            Who’s playing?
          </Text>
          <ProfilePicker
            profiles={profiles}
            onPick={(p) => router.push({ pathname: '/child/[childId]', params: { childId: p.id } })}
          />
        </>
      )}
      {profiles && profiles.length === 0 && (
        <View style={[styles.empty, { gap: 16 * s }]}>
          <View
            style={[styles.emptyAvatar, { width: empty, height: empty, borderRadius: empty / 2 }]}
          >
            <Icon name="plus" size={empty * 0.4} tint={color.kidInkSoft} stroke={3} />
          </View>
          <Text style={[type.hero, { fontSize: 28 * s, lineHeight: 34 * s, maxWidth: 300 }]}>
            {EMPTY_MESSAGE}
          </Text>
        </View>
      )}
    </KidScreen>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center' },
  emptyAvatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderStyle: 'dashed',
    borderColor: color.kidLineStrong,
  },
  dev: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  devButton: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: color.kidLineStrong,
  },
  devText: { fontSize: 12, color: color.kidInkSoft },
});
