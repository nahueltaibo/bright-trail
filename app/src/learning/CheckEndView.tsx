import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Star } from '../design/Icon';
import { Text } from '../design/Text';
import { ArtDisc, KidButton, KidScreen, useKidType } from '../design/kid';
import { color, shadow } from '../design/tokens';
import { SpeakerButton, useAutoNarration } from '../narration';
import type { CheckEnd } from '../session';
import { useLayout } from './theme';

/** `dur-star`: the star landing on the trail, the longest motion in the app. */
export const DUR_STAR_MS = 600;
const EASE_GENTLE = Easing.bezier(0.2, 0.8, 0.2, 1);
const NATIVE = Platform.OS !== 'web';

/** What the screen says when a check or review ends. No counts of misses. */
export function checkEndText({ check, passed, skillTitle, storyAgain }: CheckEnd) {
  if (!passed) {
    return {
      title: 'Almost there!',
      body: storyAgain
        ? 'Let’s look at the story again, then try once more. Every try helps you grow.'
        : 'Every try helps you grow.',
    };
  }
  return check === 'review'
    ? { title: 'Still got it!', body: `${skillTitle} stays bright on your trail.` }
    : { title: 'You did it!', body: `${skillTitle} is done. Your star is on the trail.` };
}

/**
 * The screen after a check or review. A pass lands a star on a stone, then goes to the trail. A
 * miss offers Later, and the story again or, once walk-back starts, just Keep going.
 */
export function CheckEndView({
  end,
  onTrail,
  onNext,
}: {
  end: CheckEnd;
  /** Home, where the trail is. Also the miss screen's Later. */
  onTrail: () => void;
  /** The story again, or whatever the session picks next. */
  onNext: () => void;
}) {
  const type = useKidType();
  const { title, body } = checkEndText(end);
  const message = `${title} ${body}`;
  useAutoNarration(message);

  const bottom = end.passed ? (
    <KidButton icon="next" label="See my trail" showLabel size="xl" onPress={onTrail} />
  ) : (
    [
      <KidButton key="l" icon="home" label="Later" variant="plain" showLabel onPress={onTrail} />,
      end.storyAgain ? (
        <KidButton key="n" icon="book" label="Story again" showLabel onPress={onNext} />
      ) : (
        <KidButton key="n" icon="next" label="Keep going" showLabel onPress={onNext} />
      ),
    ]
  );

  return (
    <KidScreen safe={false} left={<SpeakerButton text={message} />} bottom={bottom}>
      {end.passed ? (
        <StarLanding />
      ) : (
        <ArtDisc icon="sprout" tint={color.hitInk} background={color.hitBg} />
      )}
      <Text accessibilityRole="header" style={type.hero}>
        {title}
      </Text>
      <Text style={type.lede}>{body}</Text>
    </KidScreen>
  );
}

/** A star drops onto a mastered stone over `dur-star`. Off under reduced motion; a tap skips it. */
function StarLanding() {
  const { scale: s } = useLayout();
  const [landed] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let live = true;
    let drop: Animated.CompositeAnimation | null = null;
    void Promise.resolve(AccessibilityInfo.isReduceMotionEnabled?.())
      .catch(() => false)
      .then((reduce) => {
        if (!live) return;
        if (reduce) return landed.setValue(1);
        drop = Animated.timing(landed, {
          toValue: 1,
          duration: DUR_STAR_MS,
          easing: EASE_GENTLE,
          useNativeDriver: NATIVE,
        });
        drop.start();
      });
    return () => {
      live = false;
      drop?.stop();
    };
  }, [landed]);

  const skip = () => {
    landed.stopAnimation();
    landed.setValue(1);
  };

  return (
    <Pressable
      testID="star-landing"
      accessible
      accessibilityRole="image"
      accessibilityLabel="A star on your trail"
      onPress={skip}
      style={styles.landing}
    >
      <Animated.View
        style={{
          opacity: landed,
          transform: [
            { translateY: landed.interpolate({ inputRange: [0, 1], outputRange: [-40 * s, 0] }) },
            { scale: landed.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) },
          ],
        }}
      >
        <Star size={140 * s} />
      </Animated.View>
      <View
        style={[
          styles.stone,
          { width: 110 * s, height: 36 * s, borderRadius: 55 * s, marginTop: -18 * s },
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  landing: { alignItems: 'center' },
  stone: {
    borderWidth: 3,
    borderColor: color.starInk,
    backgroundColor: color.kidSurface,
    ...shadow.ledge,
  },
});
