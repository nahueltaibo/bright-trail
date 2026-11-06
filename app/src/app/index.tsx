import type { ChildProfile } from '@bright-trail/shared';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProfilePicker } from '../components/ProfilePicker';
import { addSampleChildren } from '../dev/sampleChildren';
import { useStorage } from '../storage/StorageProvider';

/** Kid home: pick who's playing. */
export default function ProfilePickerScreen() {
  const repo = useStorage();
  const [profiles, setProfiles] = useState<ChildProfile[] | null>(null);

  const reload = useCallback(() => {
    repo.children.list().then(setProfiles);
  }, [repo]);

  // Reload on focus so children added in the parent area show up on return.
  useFocusEffect(reload);

  const addSamples = async () => {
    await addSampleChildren(repo);
    reload();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <Link href="/parent" asChild>
          <Pressable accessibilityRole="button" accessibilityLabel="Parent area" hitSlop={12}>
            <Text style={styles.lock}>🔒</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.body}>
        {profiles && profiles.length > 0 ? (
          <ProfilePicker
            profiles={profiles}
            onPick={(p) => router.push({ pathname: '/child/[childId]', params: { childId: p.id } })}
          />
        ) : (
          profiles && <Text style={styles.empty}>Ask a grown-up to add you.</Text>
        )}

        {__DEV__ && (
          <Pressable accessibilityRole="button" onPress={addSamples} style={styles.devButton}>
            <Text style={styles.devText}>Dev: add sample kids</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFBF0' },
  topBar: { flexDirection: 'row', justifyContent: 'flex-end', padding: 16 },
  lock: { fontSize: 28, opacity: 0.6 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 32, padding: 24 },
  empty: { fontSize: 22, color: '#5A4A1F', textAlign: 'center' },
  devButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#999',
  },
  devText: { fontSize: 14, color: '#666' },
});
