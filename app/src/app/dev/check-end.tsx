import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color } from '../../design/tokens';
import { SHOW_DEV_TOOLS } from '../../devTools';
import { CheckEndView } from '../../learning';
import type { CheckEnd } from '../../session';

const base = { skillId: 'k-count-to-20', skillTitle: 'Count to 20', storyAgain: false };
const ENDS: { label: string; end: CheckEnd }[] = [
  { label: 'check passed', end: { ...base, check: 'check', passed: true } },
  { label: 'review passed', end: { ...base, check: 'review', passed: true } },
  { label: 'check missed', end: { ...base, check: 'check', passed: false, storyAgain: true } },
  { label: 'walk-back', end: { ...base, check: 'check', passed: false } },
];

/** Dev only: every check-end screen. Tapping a button shows the next one. */
export default function CheckEndDemoScreen() {
  const [index, setIndex] = useState(0);
  if (!SHOW_DEV_TOOLS) return <Redirect href="/" />;
  const { label, end } = ENDS[index];
  const next = () => setIndex((i) => (i + 1) % ENDS.length);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.devBar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.devText}>⬅ Exit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={next} hitSlop={8}>
          <Text style={styles.devText}>
            {index + 1}/{ENDS.length} · {label} ⏭
          </Text>
        </Pressable>
      </View>
      <CheckEndView key={index} end={end} onTrail={next} onNext={next} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.kidBg },
  devBar: {
    flexDirection: 'row',
    columnGap: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#999',
  },
  devText: { fontSize: 12, color: '#666' },
});
