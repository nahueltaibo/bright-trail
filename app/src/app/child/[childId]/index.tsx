import { localClock, type ChildProfile } from '@bright-trail/shared';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TrailMap } from '../../../components/TrailMap';
import { loadBundle } from '../../../content/loadBundle';
import {
  AvatarDisc,
  KidButton,
  KidIconButton,
  KidScreen,
  StarPill,
  useKidType,
} from '../../../design/kid';
import { color, radius } from '../../../design/tokens';
import { useLayout } from '../../../learning/theme';
import { SpeakerButton, useAutoNarration } from '../../../narration';
import { buildTrail, countStars, type Trail } from '../../../session';
import { useStorage } from '../../../storage/StorageProvider';
import { Text } from '../../../design/Text';

type Home = { child: ChildProfile | null; stars: number; trail: Trail };

/** Per-child home: a greeting, the trail, and one big button that starts a session. */
export default function ChildHomeScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const type = useKidType();
  const { scale: s, landscape } = useLayout();
  const [home, setHome] = useState<Home | undefined>(undefined);

  // Reload on focus so stars earned in a session show on return.
  useFocusEffect(
    useCallback(() => {
      let live = true;
      Promise.all([
        repo.children.get(childId),
        repo.mastery.listForChild(childId),
        repo.placement.get(childId),
        loadBundle(),
      ]).then(([child, mastery, placement, bundle]) => {
        if (!live) return;
        const placed = !!placement?.finishedAt;
        const trail = buildTrail(bundle.skills, mastery, placed, localClock().today);
        setHome({ child, stars: countStars(mastery), trail });
      });
      return () => {
        live = false;
      };
    }, [repo, childId]),
  );

  const child = home?.child;
  const mode = home?.trail.mode;
  const greeting =
    home === undefined
      ? null
      : child
        ? `Hi ${child.firstName}! ${mode === 'review' ? REVIEW_HINT : mode === 'new' ? NEW_HINT : START_HINT}`
        : GONE_MESSAGE;
  useAutoNarration(greeting);

  if (home === undefined) return <KidScreen />;

  const goHome = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const start = () => router.push({ pathname: '/child/[childId]/session', params: { childId } });
  const left = <KidIconButton icon="home" label="Back to profiles" onPress={goHome} />;
  const right = greeting && <SpeakerButton text={greeting} />;

  if (!child) {
    return (
      <KidScreen left={left} right={right}>
        <Text style={type.lede}>{GONE_MESSAGE}</Text>
      </KidScreen>
    );
  }

  const cta =
    mode === 'new' ? (
      <KidButton icon="play" label="Let’s go" showLabel size="xl" onPress={start} />
    ) : mode === 'review' ? (
      <KidButton icon="refresh" label="Review" showLabel size="xl" onPress={start} />
    ) : (
      <KidButton icon="play" label="Start" showLabel size="xl" onPress={start} />
    );
  const showStars = mode !== 'new';

  return (
    <KidScreen
      left={left}
      mid={
        <View style={[styles.greet, { gap: 12 * s }]}>
          <AvatarDisc animal={child.avatar} size={56 * s} />
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[type.hero, { fontSize: 32 * s, lineHeight: 38 * s, flexShrink: 1 }]}
          >
            Hi, {child.firstName}!
          </Text>
        </View>
      }
      right={right}
      bottom={
        <>
          {showStars && <StarPill count={home.stars} />}
          {cta}
        </>
      }
      spread={showStars && !landscape}
    >
      <View style={[styles.panel, { paddingVertical: 28 * s, paddingHorizontal: 12 * s }]}>
        <TrailMap stops={home.trail.stops} avatar={child.avatar} horizontal={landscape} />
      </View>
    </KidScreen>
  );
}

const START_HINT = 'Tap start.';
const NEW_HINT = 'Tap let’s go to find your spot on the trail.';
const REVIEW_HINT = 'Let’s do a quick review first.';
const GONE_MESSAGE = 'This profile is gone. Tap the house to go back.';

const styles = StyleSheet.create({
  greet: { flexDirection: 'row', alignItems: 'center', minWidth: 0, flexShrink: 1 },
  panel: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: color.meadow,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
});
