import type { StoryNugget } from '@bright-trail/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BigButton, FlagButton, ReplayButton, TopBar } from './controls';
import { colors, fontSizeFor, useLayout } from './theme';
import type { FlagTarget, Narrate } from './types';
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
  const card = nugget.cards[index];
  const last = index === nugget.cards.length - 1;

  const narrateRef = useRef(narrate);
  useEffect(() => {
    narrateRef.current = narrate;
  });
  useEffect(() => {
    narrateRef.current?.([nugget.cards[index].narration]);
  }, [nugget, index]);

  const back = (
    <BigButton
      label="Back"
      icon="◀"
      tone="plain"
      disabled={index === 0}
      onPress={() => setIndex((i) => Math.max(0, i - 1))}
    />
  );
  const next = last ? (
    <BigButton label="Done" icon="✔" onPress={() => onDone?.()} />
  ) : (
    <BigButton label="Next" icon="▶" onPress={() => setIndex((i) => i + 1)} />
  );

  const body = (
    <View style={[styles.body, landscape && styles.bodyLandscape]}>
      {card.visual && <FitVisual key={index} visual={card.visual} />}
      {card.text && (
        <Text
          style={[
            styles.text,
            landscape && card.visual && styles.textLandscape,
            { fontSize: fontSizeFor(card.text, 64 * scale) },
          ]}
        >
          {card.text}
        </Text>
      )}
    </View>
  );

  return (
    <View style={styles.screen}>
      <TopBar
        left={<ReplayButton onPress={() => narrateRef.current?.([card.narration])} />}
        right={
          <FlagButton
            key={index}
            onFlag={() => onFlag?.({ contentKind: 'card', contentId: nugget.id, cardIndex: index })}
          />
        }
      />
      {landscape ? (
        <View style={styles.row}>
          {back}
          {body}
          {next}
        </View>
      ) : (
        <>
          {body}
          <View style={styles.nav}>
            {back}
            {next}
          </View>
        </>
      )}
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={`Card ${index + 1} of ${nugget.cards.length}`}
      >
        {nugget.cards.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 16,
  },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 16 },
  bodyLandscape: { flexDirection: 'row' },
  text: { color: colors.ink, fontWeight: '700', textAlign: 'center' },
  textLandscape: { flex: 1 },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
  },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.line },
  dotOn: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.accent },
});
