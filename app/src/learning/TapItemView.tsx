import type { Choice, TapItem } from '@bright-trail/shared';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { ItemFrame, useItemAttempt } from './ItemFrame';
import { colors, fontSizeFor, formatNumber, MIN_TAP, useLayout } from './theme';
import type { ItemViewProps } from './types';
import { VisualView } from './VisualView';

// FNV-1a. Enough to scatter a handful of choice ids.
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Orders choices by a hash of seed and choice id. The same seed gives the same order, so a
 * re-render never moves a choice under the child's finger.
 */
export function shuffleChoices<T extends { id: string }>(choices: readonly T[], seed: string): T[] {
  return [...choices].sort((a, b) => hash(`${seed}:${a.id}`) - hash(`${seed}:${b.id}`));
}

export function choiceLabel(choice: Choice): string {
  switch (choice.kind) {
    case 'text':
      return choice.text;
    case 'number':
      return formatNumber(choice.value);
    case 'visual':
      return choice.narration;
  }
}

export type TapItemViewProps = ItemViewProps<TapItem> & {
  /** Fixes the choice order, for tests. Defaults to a new order on each mount. */
  shuffleSeed?: string;
};

/** Tap one of 2–4 big choices. Answers immediately: no confirm step for a 6-year-old. */
export function TapItemView(props: TapItemViewProps) {
  const { item, shuffleSeed } = props;
  const { scale, landscape, tablet } = useLayout();
  const { outcome, answer, replay } = useItemAttempt(props);
  const [seed] = useState(() => shuffleSeed ?? Math.random().toString(36).slice(2));
  const choices = useMemo(() => shuffleChoices(item.choices, seed), [item.choices, seed]);
  const [tileWidth, setTileWidth] = useState(0);

  const twoUp = choices.length === 2;
  // A landscape phone has ~350pt of height for two rows of choices plus the feedback.
  const baseHeight = landscape && !tablet ? (twoUp ? 120 : 88) : twoUp ? 160 : 120;
  const tileHeight = Math.max(MIN_TAP, baseHeight * scale);

  return (
    <ItemFrame {...props} replay={replay} outcome={outcome} visual={item.visual}>
      <View style={styles.grid}>
        {choices.map((choice) => {
          const label = choiceLabel(choice);
          const chosen = outcome?.answer === choice.id;
          const isAnswer = choice.id === item.answerChoiceId;
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: chosen, disabled: !!outcome }}
              disabled={!!outcome}
              onLayout={(e: LayoutChangeEvent) => setTileWidth(e.nativeEvent.layout.width)}
              onPress={() => answer(choice.id, isAnswer, [label])}
              style={({ pressed }) => [
                styles.tile,
                { height: tileHeight, borderRadius: 28 * scale },
                pressed && styles.pressed,
                outcome && isAnswer && styles.answerTile,
                outcome && chosen && !isAnswer && styles.missTile,
                outcome && !chosen && !isAnswer && styles.faded,
              ]}
            >
              {choice.kind === 'visual' ? (
                <VisualView
                  visual={choice.visual}
                  width={Math.max(tileWidth - 24, 40)}
                  height={tileHeight - 24}
                />
              ) : (
                <Text style={[styles.choiceText, { fontSize: fontSizeFor(label, 56 * scale) }]}>
                  {label}
                </Text>
              )}
            </Pressable>
          );
        })}
      </View>
    </ItemFrame>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: 'transparent',
    padding: 8,
  },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: colors.pressed },
  answerTile: { backgroundColor: colors.good, borderColor: colors.goodInk },
  missTile: { backgroundColor: colors.gentle },
  faded: { opacity: 0.45 },
  choiceText: { color: colors.ink, fontWeight: '700', textAlign: 'center' },
});
