import type { Choice, TapItem } from '@bright-trail/shared';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Icon } from '../design/Icon';
import { font, pressDown, radius, shadow } from '../design/tokens';
import { ItemFrame, useItemAttempt } from './ItemFrame';
import { questionSpeech } from './speech';
import {
  ANSWER_PANE_SHARE,
  colors,
  fitFontSize,
  LINE_HEIGHT,
  formatNumber,
  MIN_TAP,
  useLayout,
} from './theme';
import type { ItemViewProps } from './types';
import { VisualView } from './VisualView';
import { Text } from '../design/Text';

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
  const { scale, landscape, tablet, width } = useLayout();
  const [seed] = useState(() => shuffleSeed ?? Math.random().toString(36).slice(2));
  const choices = useMemo(() => shuffleChoices(item.choices, seed), [item.choices, seed]);
  const { outcome, answer, replay } = useItemAttempt(props, questionSpeech(item, choices));
  const [gridWidth, setGridWidth] = useState(0);

  const twoUp = choices.length === 2;
  // A landscape phone has ~350pt of height for two rows of choices plus the feedback.
  const baseHeight = landscape && !tablet ? (twoUp ? 120 : 88) : twoUp ? 160 : 104;
  const tileHeight = Math.max(MIN_TAP, baseHeight * scale);

  // Until the grid lays out, guess from the window. The guess only sets the first frame's text.
  const across = gridWidth || (landscape ? width * ANSWER_PANE_SHARE : width) - 32;
  const tileWidthFor = (columns: number) => (across - GAP * (columns - 1)) / columns;
  const fit = (label: string, columns: number) =>
    fitFontSize(
      label,
      { width: tileWidthFor(columns) - TILE_INSET, height: tileHeight - TILE_INSET },
      { base: 48 * scale, min: 14 * scale },
    );
  const labels = choices.filter((c) => c.kind !== 'visual').map(choiceLabel);
  // Three long labels side by side shrink to an unreadable size, so they wrap to two columns.
  const columns =
    choices.length === 3 && labels.every((l) => fit(l, 3) >= MIN_FONT * scale) ? 3 : 2;
  const tileWidth = tileWidthFor(columns);
  // One size for every choice, so a short label doesn't look like the favourite.
  const textSize = Math.min(48 * scale, ...labels.map((l) => fit(l, columns)));

  return (
    <ItemFrame {...props} replay={replay} outcome={outcome} visual={item.visual}>
      <View
        style={styles.grid}
        onLayout={(e: LayoutChangeEvent) => setGridWidth(e.nativeEvent.layout.width)}
      >
        {choices.map((choice) => {
          const label = choiceLabel(choice);
          const chosen = outcome?.answer === choice.id;
          const isAnswer = choice.id === item.answerChoiceId;
          const state = !outcome ? 'idle' : isAnswer ? 'right' : chosen ? 'missed' : 'rest';
          return (
            <Pressable
              key={choice.id}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: chosen, disabled: !!outcome }}
              disabled={!!outcome}
              onPress={() => answer(choice.id, isAnswer, [label])}
              style={({ pressed }) => [
                styles.tile,
                {
                  height: tileHeight,
                  borderRadius: radius.lg,
                  flexBasis: columns === 3 ? '28%' : '45%',
                },
                pressed && pressDown,
                state !== 'idle' && styles.settled,
                state === 'right' && styles.answerTile,
                state === 'missed' && styles.missTile,
                state === 'rest' && styles.restTile,
              ]}
            >
              <View style={state === 'rest' && styles.faded}>
                {choice.kind === 'visual' ? (
                  <VisualView
                    visual={choice.visual}
                    width={Math.max(tileWidth - TILE_INSET, 40)}
                    height={tileHeight - TILE_INSET}
                  />
                ) : (
                  <Text
                    numberOfLines={3}
                    adjustsFontSizeToFit
                    style={[
                      styles.choiceText,
                      { fontSize: textSize, lineHeight: textSize * LINE_HEIGHT },
                      state === 'right' && { color: colors.goodInk },
                      state === 'missed' && { color: colors.gentleInk },
                    ]}
                  >
                    {label}
                  </Text>
                )}
              </View>
              {(state === 'right' || state === 'missed') && (
                <View
                  style={[
                    styles.badge,
                    {
                      width: 36 * scale,
                      height: 36 * scale,
                      top: -12 * scale,
                      right: -12 * scale,
                      backgroundColor: state === 'right' ? colors.goodInk : colors.gentleInk,
                    },
                  ]}
                >
                  <Icon
                    name={state === 'right' ? 'check' : 'sprout'}
                    size={22 * scale}
                    tint={state === 'right' ? colors.good : colors.gentle}
                    stroke={3.2}
                  />
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </ItemFrame>
  );
}

const GAP = 16;
// Padding plus border on each side of a tile.
const TILE_INSET = 2 * (12 + 3);
// Below this, three across gives way to two columns.
const MIN_FONT = 24;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: GAP,
  },
  tile: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 3,
    borderColor: colors.line,
    padding: 12,
    ...shadow.ledge,
  },
  settled: { boxShadow: 'none' },
  answerTile: { backgroundColor: colors.good, borderColor: colors.goodInk },
  missTile: { backgroundColor: colors.gentle, borderColor: colors.gentleInk },
  restTile: { borderStyle: 'dashed' },
  faded: { opacity: 0.55 },
  choiceText: { ...font.display(700), color: colors.ink, textAlign: 'center' },
  badge: {
    position: 'absolute',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
