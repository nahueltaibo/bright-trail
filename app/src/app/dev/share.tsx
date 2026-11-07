import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHOW_DEV_TOOLS } from '../../devTools';
import { ShareGame } from '../../learning/minigames/ShareGame';
import type { ShareProblem } from '../../learning/minigames/share';
import { useNarration } from '../../narration';

const PROBLEMS: ShareProblem[] = [
  {
    id: 'cookies-8-2',
    sharer: { name: 'Maya', emoji: '👧' },
    thing: { emoji: '🍪', one: 'cookie', many: 'cookies' },
    friends: [
      { name: 'Sam', emoji: '🧒' },
      { name: 'Lily', emoji: '👩‍🦰' },
    ],
    total: 8,
    choices: [2, 3, 4, 5],
  },
  {
    id: 'strawberries-12-3',
    sharer: { name: 'Leo', emoji: '👦' },
    thing: { emoji: '🍓', one: 'strawberry', many: 'strawberries' },
    friends: [
      { name: 'Ava', emoji: '👧' },
      { name: 'Ben', emoji: '🧒' },
      { name: 'Zoe', emoji: '👩‍🦱' },
    ],
    total: 12,
    choices: [3, 4, 5, 6],
  },
  {
    id: 'apples-6-2',
    sharer: { name: 'Nora', emoji: '👩' },
    thing: { emoji: '🍎', one: 'apple', many: 'apples' },
    friends: [
      { name: 'Max', emoji: '🧒' },
      { name: 'Ivy', emoji: '👧' },
    ],
    total: 6,
    choices: [2, 3, 4],
  },
];

/** Dev only: a trial of the sharing minigame, to judge it before it becomes an item type. */
export default function ShareDemoScreen() {
  const [index, setIndex] = useState(0);
  const [log, setLog] = useState('');
  const { narrate, speak } = useNarration();

  if (!SHOW_DEV_TOOLS) return <Redirect href="/" />;
  const problem = PROBLEMS[index];
  const next = () => {
    setLog('');
    setIndex((i) => (i + 1) % PROBLEMS.length);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.devBar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.devText}>⬅ Exit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={next} hitSlop={8}>
          <Text style={styles.devText}>
            {index + 1}/{PROBLEMS.length} · {problem.id} ⏭
          </Text>
        </Pressable>
        <Text style={styles.devText}>{log}</Text>
      </View>
      <ShareGame
        key={problem.id}
        problem={problem}
        narrate={(texts, options) => (options?.replay ? speak : narrate)(texts)}
        onAnswer={(each, correct) => setLog(`first try: ${each} ${correct ? '✔' : '✘'}`)}
        onNext={next}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFBF0' },
  devBar: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#999',
  },
  devText: { fontSize: 12, color: '#666' },
});
