import type { Visual } from '@bright-trail/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BigButton, FlagButton, ReplayButton, TopBar } from './controls';
import { colors, CORRECT_TEXT, fontSizeFor, MISS_TEXT, useLayout } from './theme';
import type { AnswerResult, ItemViewProps } from './types';
import { FitVisual } from './VisualView';

export type Outcome = { answer: string | number; correct: boolean };

/**
 * Timing, replays, and narration shared by every item type. Narrates the question on mount.
 * Callers should key the item view by item id so a new item starts fresh.
 */
export function useItemAttempt({ item, narrate, onAnswer }: ItemViewProps) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const startedAt = useRef(0);
  const replays = useRef(0);
  const lastSpoken = useRef<string[]>([]);
  const answered = useRef(false);

  // Latest callbacks in refs, so an inline `narrate` prop doesn't re-narrate every render.
  const narrateRef = useRef(narrate);
  const onAnswerRef = useRef(onAnswer);
  useEffect(() => {
    narrateRef.current = narrate;
    onAnswerRef.current = onAnswer;
  });

  useEffect(() => {
    startedAt.current = Date.now();
    lastSpoken.current = [item.narration];
    narrateRef.current?.(lastSpoken.current);
  }, [item.id, item.narration]);

  const replay = () => {
    if (!answered.current) replays.current += 1;
    narrateRef.current?.(lastSpoken.current);
  };

  /** Locks the item, speaks the feedback, and reports the result. `lead` is said first. */
  const answer = (value: string | number, correct: boolean, lead: string[] = []) => {
    // A ref, not state: two fast taps land before the re-render.
    if (answered.current) return;
    answered.current = true;
    setOutcome({ answer: value, correct });
    lastSpoken.current = [...lead, ...(correct ? [CORRECT_TEXT] : [MISS_TEXT, item.why])];
    narrateRef.current?.(lastSpoken.current);
    const result: AnswerResult = {
      itemId: item.id,
      answer: value,
      correct,
      msToAnswer: Math.max(0, Math.round(Date.now() - startedAt.current)),
      replays: replays.current,
    };
    onAnswerRef.current?.(result);
  };

  return { outcome, answer, replay };
}

/** Gentle feedback: a star for a hit, a hint and the "why" for a miss. Never red. */
export function Feedback({
  correct,
  why,
  onNext,
}: {
  correct: boolean;
  why: string;
  onNext?: () => void;
}) {
  const { scale } = useLayout();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.feedback, correct ? styles.feedbackGood : styles.feedbackGentle]}
    >
      <Text style={[styles.feedbackIcon, { fontSize: 44 * scale, lineHeight: 56 * scale }]}>
        {correct ? '🌟' : '💡'}
      </Text>
      <View style={styles.feedbackText}>
        <Text
          style={[
            styles.feedbackTitle,
            { fontSize: 28 * scale, color: correct ? colors.goodInk : colors.gentleInk },
          ]}
        >
          {correct ? CORRECT_TEXT : MISS_TEXT}
        </Text>
        {!correct && <Text style={[styles.why, { fontSize: 20 * scale }]}>{why}</Text>}
      </View>
      <BigButton label="Next" icon="▶" onPress={() => onNext?.()} />
    </View>
  );
}

type ItemFrameProps = Pick<ItemViewProps, 'item' | 'onFlag' | 'onNext'> & {
  replay: () => void;
  outcome: Outcome | null;
  visual?: Visual;
  /** The answer area: choices, keypad, or number line. */
  children: ReactNode;
};

/**
 * Screen frame for an item. Portrait stacks question over answer. Landscape puts them side by
 * side so the answer area keeps its height on a phone.
 */
export function ItemFrame({
  item,
  onFlag,
  onNext,
  replay,
  outcome,
  visual,
  children,
}: ItemFrameProps) {
  const { landscape, scale } = useLayout();
  const top = (
    <TopBar
      left={<ReplayButton onPress={replay} />}
      right={
        <FlagButton
          onFlag={() => onFlag?.({ contentKind: 'item', contentId: item.id, cardIndex: null })}
        />
      }
    />
  );
  const question = (
    <View style={styles.question}>
      <Text style={[styles.prompt, { fontSize: fontSizeFor(item.prompt, 56 * scale) }]}>
        {item.prompt}
      </Text>
      {visual && <FitVisual visual={visual} maxSize={360 * scale} />}
    </View>
  );
  const feedback = outcome && <Feedback correct={outcome.correct} why={item.why} onNext={onNext} />;

  if (landscape) {
    return (
      <View style={[styles.screen, styles.row]}>
        <View style={styles.pane}>
          {top}
          {question}
        </View>
        <View style={[styles.pane, styles.answerPane]}>
          <View style={styles.answer}>{children}</View>
          {feedback}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      {top}
      {question}
      <View style={styles.answer}>{children}</View>
      {feedback}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row' },
  pane: { flex: 1 },
  answerPane: { justifyContent: 'center', paddingVertical: 8 },
  question: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 8,
  },
  prompt: { color: colors.ink, fontWeight: '700', textAlign: 'center' },
  answer: { flexShrink: 1, padding: 12, justifyContent: 'center' },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 12,
    padding: 12,
    borderRadius: 24,
  },
  feedbackGood: { backgroundColor: colors.good },
  feedbackGentle: { backgroundColor: colors.gentle },
  feedbackIcon: { textAlign: 'center' },
  feedbackText: { flex: 1, gap: 4 },
  feedbackTitle: { fontWeight: '700' },
  why: { color: colors.ink },
});
