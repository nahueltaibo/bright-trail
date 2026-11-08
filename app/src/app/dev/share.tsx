import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SHOW_DEV_TOOLS } from '../../devTools';
import { ItemView } from '../../learning';
import { DEMO_ITEMS } from '../../learning/minigames/demo';
import { useNarration } from '../../narration';

/** Dev only: one sharing item per kind of question. "Measuring" plays it as placement would. */
export default function ShareDemoScreen() {
  const [index, setIndex] = useState(0);
  const [measuring, setMeasuring] = useState(false);
  const [round, setRound] = useState(0);
  const [log, setLog] = useState('');
  const { narrate, speak } = useNarration();

  if (!SHOW_DEV_TOOLS) return <Redirect href="/" />;
  const item = DEMO_ITEMS[index];
  const next = () => {
    setLog('');
    setIndex((i) => (i + 1) % DEMO_ITEMS.length);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.devBar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} hitSlop={8}>
          <Text style={styles.devText}>⬅ Exit</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={next} hitSlop={8}>
          <Text style={styles.devText}>
            {index + 1}/{DEMO_ITEMS.length} · {item.id} ⏭
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="switch"
          accessibilityState={{ checked: measuring }}
          onPress={() => {
            setMeasuring((m) => !m);
            setRound((r) => r + 1);
          }}
          hitSlop={8}
        >
          <Text style={styles.devText}>{measuring ? '📏 measuring' : '🎓 practice'}</Text>
        </Pressable>
        <Text style={styles.devText}>{log}</Text>
      </View>
      <ItemView
        key={`${item.id}:${round}`}
        item={item}
        measuring={measuring}
        narrate={(texts, options) => (options?.replay ? speak : narrate)(texts)}
        onAnswer={(r) => setLog(`first: ${r.answer} ${r.correct ? '✔' : '✘'}`)}
        onNext={next}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFBF0' },
  devBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#999',
  },
  devText: { fontSize: 12, color: '#666' },
});
