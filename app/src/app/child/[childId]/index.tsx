import type { ChildProfile, ContentBundle } from '@bright-trail/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getAvatar } from '../../../avatars';
import { loadBundle } from '../../../content/loadBundle';
import { useStorage } from '../../../storage/StorageProvider';

/** Per-child home. Placeholder until A6 puts the session and trail map here. */
export default function ChildHomeScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const [child, setChild] = useState<ChildProfile | null | undefined>(undefined);
  const [bundle, setBundle] = useState<ContentBundle | null>(null);

  useEffect(() => {
    repo.children.get(childId).then(setChild);
    loadBundle().then(setBundle);
  }, [repo, childId]);

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
      </View>
      <View style={styles.body}>
        {child ? (
          <>
            <Text style={styles.avatar}>{getAvatar(child.avatar).emoji}</Text>
            <Text style={styles.title}>Hi, {child.firstName}!</Text>
            {bundle && (
              <Text style={styles.note}>
                Your trail is coming soon. {bundle.skills.length} skills are ready.
              </Text>
            )}
          </>
        ) : (
          <Text style={styles.note}>This profile no longer exists.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFBF0' },
  topBar: { flexDirection: 'row', padding: 16 },
  back: { fontSize: 40 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  avatar: { fontSize: 120 },
  title: { fontSize: 32, color: '#5A4A1F' },
  note: { fontSize: 18, color: '#7A6A3F', textAlign: 'center' },
});
