import type { ChildProfile } from '@bright-trail/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAvatar } from '../../../avatars';
import { TrailMap } from '../../../components/TrailMap';
import { BigButton } from '../../../learning/controls';
import { SpeakerButton, useAutoNarration } from '../../../narration';
import { countStars } from '../../../session';
import { useStorage } from '../../../storage/StorageProvider';

/** Per-child home: the trail map and the button that starts a session. */
export default function ChildHomeScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const [child, setChild] = useState<ChildProfile | null | undefined>(undefined);
  const [stars, setStars] = useState(0);

  // Reload on focus so stars earned in a session show on return.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([repo.children.get(childId), repo.mastery.listForChild(childId)]).then(
        ([profile, mastery]) => {
          if (!live) return;
          setChild(profile);
          setStars(countStars(mastery));
        },
      );
      return () => {
        live = false;
      };
    }, [repo, childId]),
  );

  const greeting =
    child === undefined ? null : child ? `Hi, ${child.firstName}! ${START_HINT}` : GONE_MESSAGE;
  useAutoNarration(greeting);

  if (child === undefined) return null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to profiles"
          hitSlop={12}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        >
          <Text style={styles.back}>🏠</Text>
        </Pressable>
        {greeting && <SpeakerButton text={greeting} size={72} />}
      </View>
      <View style={styles.body}>
        {child ? (
          <>
            <Text style={styles.avatar}>{getAvatar(child.avatar).emoji}</Text>
            <Text style={styles.title}>Hi, {child.firstName}!</Text>
            <Text style={styles.note}>{START_HINT}</Text>
            <TrailMap stars={stars} />
            <BigButton
              label="Start"
              icon="▶"
              size={120}
              onPress={() =>
                router.push({ pathname: '/child/[childId]/session', params: { childId } })
              }
            />
          </>
        ) : (
          <Text style={styles.note}>{GONE_MESSAGE}</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const START_HINT = 'Tap the big button to start.';
const GONE_MESSAGE = 'This profile is gone. Tap the house to go back.';

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFBF0' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', padding: 16 },
  back: { fontSize: 40 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  avatar: { fontSize: 100 },
  title: { fontSize: 32, color: '#5A4A1F' },
  note: { fontSize: 22, color: '#7A6A3F', textAlign: 'center' },
});
