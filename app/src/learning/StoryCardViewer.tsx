import type { StoryNugget } from '@bright-trail/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { KidScreen, ProgressDots } from '../design/kid';
import { font, radius, shadow } from '../design/tokens';
import { FlagButton, KidButton, ReplayButton } from './controls';
import { QuitButton } from './quit';
import { colors, fontSizeFor, useLayout } from './theme';
import type { FlagTarget, Narrate } from './types';
import { ReadAlong } from './ReadAlong';
import { FitVisual } from './VisualView';

export type StoryCardViewerProps = {
  nugget: StoryNugget;
  narrate?: Narrate;
  onFlag?: (target: FlagTarget) => void;
  /** The child tapped "done" on the last card. */
  onDone?: () => void;
};

/** One story card per screen, narrated as it appears. */
export function StoryCardViewer({ nugget, narrate, onFlag, onDone }: StoryCardViewerProps) {
  const { landscape, scale } = useLayout();
  const [index, setIndex] = useState(0);
  const current = nugget.cards[index];
  const last = index === nugget.cards.length - 1;

  const narrateRef = useRef(narrate);
  useEffect(() => {
    narrateRef.current = narrate;
  });
  useEffect(() => {
    narrateRef.current?.([nugget.cards[index].narration]);
  }, [nugget, index]);

  const back = (
    <KidButton
      label="Back"
      icon="back"
      variant="plain"
      disabled={index === 0}
      onPress={() => setIndex((i) => Math.max(0, i - 1))}
    />
  );
  const next = last ? (
    <KidButton label="Done" icon="check" showLabel onPress={() => onDone?.()} />
  ) : (
    <KidButton label="Next" icon="next" onPress={() => setIndex((i) => i + 1)} />
  );

  const card = (
    <View
      style={[
        styles.card,
        { padding: 24 * scale, gap: 18 * scale },
        landscape ? styles.cardLandscape : styles.cardPortrait,
      ]}
    >
      <View style={[styles.body, landscape && styles.bodyLandscape]}>
        {current.visual && <FitVisual key={index} visual={current.visual} />}
        {current.text && (
          <Text
            style={[
              styles.text,
              landscape && current.visual && styles.textLandscape,
              { fontSize: fontSizeFor(current.text, 64 * scale) },
            ]}
          >
            {current.text}
          </Text>
        )}
      </View>
      <ReadAlong key={index} text={current.narration} lines={4} />
    </View>
  );
  const dots = <ProgressDots total={nugget.cards.length} current={index} />;
  const replay = (
    <ReplayButton onPress={() => narrateRef.current?.([current.narration], { replay: true })} />
  );
  const flag = (
    <FlagButton
      key={index}
      onFlag={() => onFlag?.({ contentKind: 'card', contentId: nugget.id, cardIndex: index })}
    />
  );

  if (landscape) {
    return (
      <KidScreen
        safe={false}
        left={replay}
        mid={
          <>
            <QuitButton />
            {dots}
          </>
        }
        right={flag}
        mainStyle={styles.row}
      >
        {back}
        {card}
        {next}
      </KidScreen>
    );
  }
  return (
    <KidScreen
      safe={false}
      left={replay}
      mid={<QuitButton />}
      right={flag}
      bottom={
        <>
          {back}
          {next}
        </>
      }
      spread
    >
      {card}
      {dots}
    </KidScreen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: {
    backgroundColor: colors.raised,
    borderRadius: radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    ...shadow.lift,
  },
  cardPortrait: { flex: 1, maxHeight: 560 },
  cardLandscape: { flex: 1, alignSelf: 'stretch' },
  body: { flex: 1, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center', gap: 16 },
  bodyLandscape: { flexDirection: 'row' },
  text: { ...font.display(800), color: colors.ink, textAlign: 'center' },
  textLandscape: { flex: 1 },
});
