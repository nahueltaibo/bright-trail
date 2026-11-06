import type { ContentBundle, Item, StoryNugget } from '@bright-trail/shared';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadBundle } from '../../content/loadBundle';
import { ItemView, StoryCardViewer, type FlagTarget } from '../../learning';

type Step = { kind: 'nugget'; nugget: StoryNugget } | { kind: 'item'; item: Item };

/** Each nugget, then the items for its skill: the order a lesson plays in. */
function playlist(bundle: ContentBundle): Step[] {
  return bundle.nuggets.flatMap((nugget): Step[] => [
    { kind: 'nugget', nugget },
    ...bundle.items
      .filter((item) => item.skillId === nugget.skillId)
      .map((item): Step => ({ kind: 'item', item })),
  ]);
}

function stepLabel(step: Step): string {
  return step.kind === 'nugget' ? `📖 ${step.nugget.id}` : `${step.item.type}: ${step.item.id}`;
}

/** Dev-only: plays the sample bundle's nuggets and items. Narration shows as a caption. */
export default function LearningPreviewScreen() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [log, setLog] = useState('');

  useEffect(() => {
    loadBundle().then((b) => setSteps(playlist(b)));
  }, []);

  const narrate = useCallback((texts: string[]) => setCaption(texts.join(' ')), []);
  const onFlag = useCallback((t: FlagTarget) => setLog(`flag ${JSON.stringify(t)}`), []);

  if (!__DEV__) return <Redirect href="/" />;
  if (!steps) return null;

  if (current === null) {
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.menu}>
          <Text style={styles.title}>Learning preview</Text>
          {steps.map((step, i) => (
            <Pressable
              key={stepLabel(step)}
              accessibilityRole="button"
              onPress={() => {
                setLog('');
                setCurrent(i);
              }}
              style={styles.menuRow}
            >
              <Text style={styles.menuText}>{stepLabel(step)}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={styles.menuRow}
          >
            <Text style={styles.menuText}>⬅ Exit</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const step = steps[current];
  const advance = () => setCurrent((i) => (i === null || i + 1 >= steps.length ? null : i + 1));

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.devBar}>
        <Pressable accessibilityRole="button" onPress={() => setCurrent(null)} hitSlop={8}>
          <Text style={styles.devText}>☰ Menu</Text>
        </Pressable>
        <Text style={styles.devText} numberOfLines={2}>
          {current + 1}/{steps.length} · 🔈 {caption}
        </Text>
        {log !== '' && (
          <Text style={styles.devText} numberOfLines={2}>
            {log}
          </Text>
        )}
      </View>
      {step.kind === 'nugget' ? (
        <StoryCardViewer
          key={step.nugget.id}
          nugget={step.nugget}
          narrate={narrate}
          onFlag={onFlag}
          onDone={advance}
        />
      ) : (
        <ItemView
          key={step.item.id}
          item={step.item}
          narrate={narrate}
          onFlag={onFlag}
          onAnswer={(r) => setLog(`answer ${JSON.stringify(r)}`)}
          onNext={advance}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFBF0' },
  menu: { padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700', color: '#5A4A1F' },
  menuRow: {
    minHeight: 64,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: '#FFF4D6',
  },
  menuText: { fontSize: 18, color: '#5A4A1F' },
  devBar: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 2,
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#999',
  },
  devText: { fontSize: 12, color: '#666' },
});
