import { randomUUID } from 'expo-crypto';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { loadBundle } from '../../../content/loadBundle';
import { ItemView, StoryCardViewer, type FlagTarget, type Narrate } from '../../../learning';
import { Star } from '../../../design/Icon';
import { ArtDisc, KidButton, KidScreen, StarPill, useKidType } from '../../../design/kid';
import { color } from '../../../design/tokens';
import { QuitContext } from '../../../learning/quit';
import { SpeakerButton, useAutoNarration, useNarration } from '../../../narration';
import { END_MESSAGES, Session, type SessionView } from '../../../session';
import { useLayout } from '../../../learning/theme';
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
  else if (!view || !ready) body = <Loading />;
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
      <QuitContext.Provider value={quit}>{body}</QuitContext.Provider>
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
  const { title, body } = END_MESSAGES[reason];
  const type = useKidType();
  const message = `${title} ${body}`;
  useAutoNarration(message);
  const art =
    reason === 'placement-break' ? (
      <ArtDisc icon="bookmark" />
    ) : reason === 'all-done' ? (
      <Star size={140} />
    ) : (
      <ArtDisc icon="moon" background={color.avSky} />
    );
  return (
    <KidScreen
      safe={false}
      left={<SpeakerButton text={message} />}
      bottom={<KidButton icon="home" label="Home" showLabel size="xl" onPress={onHome} />}
    >
      {art}
      <Text accessibilityRole="header" style={type.hero}>
        {title}
      </Text>
      {stars > 0 && <StarPill count={stars} />}
      <Text style={type.lede}>{body}</Text>
    </KidScreen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.kidBg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pebbles: { flexDirection: 'row', gap: 12 },
  error: { margin: 24, fontSize: 18, color: color.kidInk, textAlign: 'center' },
});

/** Three amber pebbles: the only motion that loops on a kid screen. */
function Loading() {
  const { scale: s } = useLayout();
  const d = 20 * s;
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel="Loading"
      style={[styles.center, styles.pebbles]}
    >
      {[0.35, 0.7, 1].map((o) => (
        <View
          key={o}
          style={{
            width: d,
            height: d,
            borderRadius: d / 2,
            backgroundColor: color.trail,
            opacity: o,
          }}
        />
      ))}
    </View>
  );
}
