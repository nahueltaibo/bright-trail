import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TrailMap } from '../../../components/TrailMap';
import { loadBundle } from '../../../content/loadBundle';
import { ItemView, StoryCardViewer, type FlagTarget, type Narrate } from '../../../learning';
import { BigButton } from '../../../learning/controls';
import { SpeakerButton, useAutoNarration, useNarration } from '../../../narration';
import { END_MESSAGES, Session, type SessionView } from '../../../session';
import { useStorage } from '../../../storage/StorageProvider';

/** The kid's session: placement first, then reviews, probes, lessons, and checks. */
export default function SessionScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const { ready, narrate, speak } = useNarration();
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<SessionView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const bundle = await loadBundle();
      const started = await Session.start({ repo, bundle, childId, sessionId: randomUUID() });
      if (!live) return;
      setSession(started);
      setView(started.current);
    })().catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [repo, childId]);

  const narrateItem = useCallback<Narrate>(
    (texts, options) => (options?.replay ? speak : narrate)(texts),
    [narrate, speak],
  );
  const onFlag = useCallback((target: FlagTarget) => void session?.flag(target), [session]);
  const run = useCallback(
    (step: (s: Session) => Promise<SessionView>) => {
      if (!session) return;
      step(session).then(setView, (e: Error) => setError(e.message));
    },
    [session],
  );

  const quit = () => (router.canGoBack() ? router.back() : router.replace('/'));

  let body;
  if (error) body = <Text style={styles.error}>Something went wrong: {error}</Text>;
  else if (!view || !ready) body = <ActivityIndicator size="large" style={styles.center} />;
  else if (view.kind === 'end')
    body = <EndView reason={view.reason} stars={view.stars} onHome={quit} />;
  else if (view.kind === 'story') {
    body = (
      <StoryCardViewer
        key={view.seq}
        nugget={view.nugget}
        narrate={narrateItem}
        onFlag={onFlag}
        onDone={() => run((s) => s.finishStory())}
      />
    );
  } else {
    body = (
      <ItemView
        key={view.seq}
        item={view.item}
        narrate={narrateItem}
        onFlag={onFlag}
        measuring={view.phase !== 'check'}
        onAnswer={(result) => run((s) => s.answer(result))}
        onNext={() => run((s) => s.next())}
      />
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      {view?.kind !== 'end' && (
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Stop for now"
            hitSlop={12}
            onPress={quit}
          >
            <Text style={styles.home}>🏠</Text>
          </Pressable>
        </View>
      )}
      {body}
    </SafeAreaView>
  );
}

function EndView({
  reason,
  stars,
  onHome,
}: {
  reason: keyof typeof END_MESSAGES;
  stars: number;
  onHome: () => void;
}) {
  const message = END_MESSAGES[reason];
  useAutoNarration(message);
  return (
    <View style={styles.end}>
      <SpeakerButton text={message} size={72} />
      <Text style={styles.message}>{message}</Text>
      <TrailMap stars={stars} />
      <BigButton label="Back home" icon="🏠" onPress={onHome} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFBF0' },
  topBar: { paddingHorizontal: 16, paddingTop: 4 },
  home: { fontSize: 32 },
  center: { flex: 1 },
  error: { margin: 24, fontSize: 18, color: '#b00020', textAlign: 'center' },
  end: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  message: { fontSize: 28, color: '#5A4A1F', textAlign: 'center', fontWeight: '700' },
});
