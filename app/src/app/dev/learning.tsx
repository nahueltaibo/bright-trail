import type { ContentBundle, Item, Skill, StoryNugget } from '@bright-trail/shared';
import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadContent, syncPacks } from '../../content';
import { SHOW_DEV_TOOLS } from '../../devTools';
import { ItemView, StoryCardViewer, type FlagTarget } from '../../learning';
import { formatNumber } from '../../learning/theme';
import { choiceLabel } from '../../learning/TapItemView';
import { gradeLabel } from '../../parent/grades';
import { Text } from '../../design/Text';
import { useStorage } from '../../storage/StorageProvider';

type Step = { kind: 'nugget'; nugget: StoryNugget } | { kind: 'item'; item: Item };

/** The skill's nugget, then its items: the order a lesson plays in. */
function playlist(bundle: ContentBundle, skillId: string): Step[] {
  const nugget = bundle.nuggets.find((n) => n.skillId === skillId);
  return [
    ...(nugget ? [{ kind: 'nugget', nugget } as const] : []),
    ...bundle.items
      .filter((item) => item.skillId === skillId)
      .map((item): Step => ({ kind: 'item', item })),
  ];
}

function stepLabel(step: Step): string {
  return step.kind === 'nugget' ? `📖 ${step.nugget.id}` : `${step.item.type}: ${step.item.id}`;
}

/** The right answer, and for tap items a wrong one, as the child would enter them. */
function answerKey(item: Item): { answer: string; miss?: string } {
  switch (item.type) {
    case 'tap': {
      const answer = item.choices.find((c) => c.id === item.answerChoiceId)!;
      const miss = item.choices.find((c) => c.id !== item.answerChoiceId)!;
      return { answer: choiceLabel(answer), miss: choiceLabel(miss) };
    }
    case 'keypad':
      return { answer: formatNumber(item.answer) };
    case 'number-line':
      return { answer: formatNumber(item.target) };
  }
}

/** Dev and e2e only: plays one skill's nugget and items. Narration shows as a caption. */
export default function LearningPreviewScreen() {
  const repo = useStorage();
  const [bundle, setBundle] = useState<ContentBundle | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [current, setCurrent] = useState<number | null>(null);
  const [caption, setCaption] = useState('');
  const [log, setLog] = useState('');

  // The preview plays every skill, so it downloads every pack. The next sync deletes the extras.
  useEffect(() => {
    syncPacks(repo, { extra: 'all' })
      .then(() => loadContent(repo))
      .then(setBundle);
  }, [repo]);

  const steps = useMemo(() => (bundle && skill ? playlist(bundle, skill.id) : []), [bundle, skill]);
  const narrate = useCallback((texts: string[]) => setCaption(texts.join(' ')), []);
  const onFlag = useCallback((t: FlagTarget) => setLog(`flag ${JSON.stringify(t)}`), []);

  if (!SHOW_DEV_TOOLS) return <Redirect href="/" />;
  if (!bundle) return null;

  if (!skill || current === null) {
    const rows = skill
      ? steps.map((step, i) => ({
          key: stepLabel(step),
          label: stepLabel(step),
          onPress: () => {
            setLog('');
            setCurrent(i);
          },
        }))
      : bundle.skills.map((s) => ({
          key: s.id,
          label: `${gradeLabel(s.grade)} · ${s.title} · ${s.id}`,
          onPress: () => setSkill(s),
        }));
    return (
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.menu}>
          <Text style={styles.title}>{skill ? skill.title : 'Learning preview'}</Text>
          {!skill && <Text style={styles.devText}>Bundle {bundle.version}</Text>}
          {rows.map((row) => (
            <Pressable
              key={row.key}
              accessibilityRole="button"
              onPress={row.onPress}
              style={styles.menuRow}
            >
              <Text style={styles.menuText}>{row.label}</Text>
            </Pressable>
          ))}
          <Pressable
            accessibilityRole="button"
            onPress={() => (skill ? setSkill(null) : router.back())}
            style={styles.menuRow}
          >
            <Text style={styles.menuText}>{skill ? '⬅ Skills' : '⬅ Exit'}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const step = steps[current];
  const advance = () => setCurrent((i) => (i === null || i + 1 >= steps.length ? null : i + 1));
  const key = step.kind === 'item' ? answerKey(step.item) : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.devBar}>
        <Pressable accessibilityRole="button" onPress={() => setCurrent(null)} hitSlop={8}>
          <Text style={styles.devText}>☰ Menu</Text>
        </Pressable>
        <Text style={styles.devText} numberOfLines={2}>
          {current + 1}/{steps.length} · 🔈 {caption}
        </Text>
        {key && (
          <View style={styles.devRow}>
            <Text testID="dev-answer" style={styles.devText}>
              answer: {key.answer}
            </Text>
            {key.miss !== undefined && (
              <Text testID="dev-miss" style={styles.devText}>
                miss: {key.miss}
              </Text>
            )}
          </View>
        )}
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
  devRow: { flexDirection: 'row', gap: 16 },
  devText: { fontSize: 12, color: '#666' },
});
