import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHOW_DEV_TOOLS } from '../../devTools';
import { ShareGame } from '../../learning/minigames/ShareGame';
import { KIDS, THINGS } from '../../learning/minigames/cast';
import type { ShareProblem } from '../../learning/minigames/share';
import { useNarration } from '../../narration';

const k = KIDS;

const PROBLEMS: ShareProblem[] = [
  {
    id: 'cookies-8-2',
    sharer: k.maya,
    thing: THINGS.cookie,
    container: 'plate',
    friends: [k.kofi, k.aiko],
    total: 8,
    choices: ['2', '3', '4', '5'],
  },
  {
    id: 'apples-12-3',
    sharer: k.mateo,
    thing: THINGS.apple,
    container: 'basket',
    friends: [k.priya, k.liam, k.amara],
    total: 12,
    choices: ['3', '4', '5', '6'],
  },
  {
    id: 'balls-6-2',
    sharer: k.amara,
    thing: THINGS.ball,
    container: 'bucket',
    friends: [k.wei, k.sofia],
    total: 6,
    choices: ['2', '3', '4'],
  },
  {
    id: 'teddies-9-3',
    sharer: k.omar,
    thing: THINGS.teddy,
    container: 'box',
    friends: [k.maya, k.mateo, k.aiko],
    total: 9,
    choices: ['2', '3', '4'],
  },
  {
    id: 'strawberries-10-2',
    sharer: k.aiko,
    thing: THINGS.strawberry,
    container: 'bowl',
    friends: [k.omar, k.liam],
    total: 10,
    choices: ['4', '5', '6', '7'],
  },
  {
    id: 'cookies-5-2-halves',
    sharer: k.priya,
    thing: THINGS.cookie,
    container: 'plate',
    friends: [k.omar, k.sofia],
    total: 5,
    choices: ['1 1/2', '2', '2 1/2', '3'],
  },
  {
    id: 'pies-3-4-quarters',
    sharer: k.wei,
    thing: THINGS.pie,
    container: 'plate',
    friends: [k.maya, k.kofi, k.sofia, k.mateo],
    total: 3,
    choices: ['1/4', '1/2', '3/4', '1'],
  },
  {
    id: 'sandwiches-4-3-thirds',
    sharer: k.liam,
    thing: THINGS.sandwich,
    container: 'box',
    friends: [k.amara, k.wei, k.priya],
    total: 4,
    choices: ['1', '1 1/3', '1 2/3', '2'],
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
