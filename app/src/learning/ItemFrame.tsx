import type { Visual } from '@bright-trail/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { Icon, Star } from '../design/Icon';
import { font, radius } from '../design/tokens';
import { FlagButton, KidButton, ReplayButton, TopBar } from './controls';
import { ProgressDots } from '../design/kid';
import { QuitButton } from './quit';
import { ANSWER_PANE_SHARE, colors, CORRECT_TEXT, MISS_TEXT, useLayout } from './theme';
import { ReadAlong } from './ReadAlong';
import { questionSpeech } from './speech';
import type { AnswerResult, ItemViewProps } from './types';
import { FitVisual } from './VisualView';
import { Text } from '../design/Text';

export type Outcome = { answer: string | number; correct: boolean };

/**
 * Timing, replays, and narration shared by every item type. Narrates `question` on mount.
 * Callers should key the item view by item id so a new item starts fresh.
 */
export function useItemAttempt(
  { item, narrate, onAnswer }: ItemViewProps,
  question: string[] = questionSpeech(item),
) {
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const startedAt = useRef(0);
  const replays = useRef(0);
  const lastSpoken = useRef<string[]>([]);
  const answered = useRef(false);

  // Latest callbacks in refs, so an inline `narrate` prop doesn't re-narrate every render.
  const narrateRef = useRef(narrate);
  const onAnswerRef = useRef(onAnswer);
  const questionRef = useRef(question);
  useEffect(() => {
    narrateRef.current = narrate;
    onAnswerRef.current = onAnswer;
  });

  useEffect(() => {
    startedAt.current = Date.now();
    lastSpoken.current = questionRef.current;
    narrateRef.current?.(lastSpoken.current);
  }, [item.id, item.narration]);

  const replay = () => {
    if (!answered.current) replays.current += 1;
    narrateRef.current?.(lastSpoken.current, { replay: true });
  };

  /**
   * Locks the item, speaks the feedback, and reports the result. `lead` is said first. With
   * `after`, the result is reported now and the feedback waits for it, e.g. for a play-out.
   */
  const answer = (
    value: string | number,
    correct: boolean,
    lead: string[] = [],
    after?: Promise<unknown>,
  ) => {
    // A ref, not state: two fast taps land before the re-render.
    if (answered.current) return;
    answered.current = true;
    const show = () => {
      setOutcome({ answer: value, correct });
      lastSpoken.current = [...lead, ...(correct ? [CORRECT_TEXT] : [MISS_TEXT, item.why])];
      narrateRef.current?.(lastSpoken.current);
    };
    if (!after) show();
    const result: AnswerResult = {
      itemId: item.id,
      answer: value,
      correct,
      msToAnswer: Math.max(0, Math.round(Date.now() - startedAt.current)),
      replays: replays.current,
    };
    onAnswerRef.current?.(result);
    if (after) void after.then(show);
  };

  return { outcome, answer, replay };
}

/** Gentle feedback: a star for a hit, a sprout and the "why" for a miss. Never red. */
export function Feedback({
  correct,
  why,
  onNext,
  title = correct ? CORRECT_TEXT : MISS_TEXT,
  showWhy = !correct,
  action,
}: {
  correct: boolean;
  why: string;
  onNext?: () => void;
  title?: string;
  showWhy?: boolean;
  /** Replaces the Next button, e.g. with Try again. */
  action?: ReactNode;
}) {
  const { scale: s } = useLayout();
  const ink = correct ? colors.goodInk : colors.gentleInk;
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.feedback,
        { gap: 14 * s, padding: 14 * s, paddingLeft: 18 * s },
        correct ? styles.feedbackGood : styles.feedbackGentle,
      ]}
    >
      {correct ? (
        <Star size={52 * s} />
      ) : (
        <Icon name="sprout" size={52 * s} tint={ink} stroke={2.2} />
      )}
      <View style={styles.feedbackText}>
        <Text style={[styles.feedbackTitle, { fontSize: 28 * s, lineHeight: 31 * s, color: ink }]}>
          {title}
        </Text>
        {showWhy && (
          <Text style={[styles.why, { fontSize: 17 * s, lineHeight: 23 * s, color: ink }]}>
            {why}
          </Text>
        )}
      </View>
      {action ?? <KidButton label="Next" icon="next" onPress={() => onNext?.()} />}
    </View>
  );
}

type ItemFrameProps = Pick<ItemViewProps, 'item' | 'onFlag' | 'onNext' | 'progress'> & {
  replay: () => void;
  outcome: Outcome | null;
  visual?: Visual;
  /** The answer area: choices, keypad, or number line. */
  children: ReactNode;
};

/**
 * Screen frame for an item. Portrait stacks question over answer, with the feedback at the
 * bottom. Landscape splits question (45%) and answer (55%) so the answer keeps its height.
 */
export function ItemFrame({
  item,
  onFlag,
  onNext,
  progress,
  replay,
  outcome,
  visual,
  children,
}: ItemFrameProps) {
  const { landscape, scale: s, tablet } = useLayout();
  const flag = (
    <FlagButton
      onFlag={() => onFlag?.({ contentKind: 'item', contentId: item.id, cardIndex: null })}
    />
  );
  // The dots take the middle, so the break button moves beside the flag.
  const top = progress ? (
    <TopBar
      left={<ReplayButton onPress={replay} />}
      mid={<ProgressDots steps noun="Question" {...progress} />}
      right={
        <>
          <QuitButton />
          {flag}
        </>
      }
    />
  ) : (
    <TopBar left={<ReplayButton onPress={replay} />} mid={<QuitButton />} right={flag} />
  );
  const question = (
    <View style={[styles.question, { gap: 12 * s }]}>
      <Text style={[styles.prompt, { fontSize: 28 * s, lineHeight: 34 * s }]}>{item.prompt}</Text>
      <ReadAlong text={item.narration} />
      {visual && <FitVisual visual={visual} maxSize={360 * s} />}
    </View>
  );
  const feedback = outcome && <Feedback correct={outcome.correct} why={item.why} onNext={onNext} />;
  const pad = tablet
    ? { paddingTop: 28, paddingHorizontal: 40, paddingBottom: 32 }
    : { paddingTop: 14 * s, paddingHorizontal: 16 * s, paddingBottom: 20 * s };

  if (landscape) {
    return (
      <View style={[styles.screen, pad, { gap: 12 * s }]}>
        {top}
        <View style={[styles.row, { gap: 28 * s }]}>
          <View style={styles.pane}>{question}</View>
          <View style={[styles.answerPane, { gap: 18 * s }]}>
            <View style={styles.answer}>{children}</View>
            {feedback}
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.screen, pad, { gap: 12 * s }]}>
      {top}
      {question}
      <View style={styles.answer}>{children}</View>
      {feedback}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  pane: { flex: 1 - ANSWER_PANE_SHARE, alignSelf: 'stretch' },
  answerPane: { flex: ANSWER_PANE_SHARE, justifyContent: 'center' },
  question: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  prompt: { ...font.display(700), color: colors.ink, textAlign: 'center' },
  // The question gives way first: answer controls must keep their full tap size.
  answer: { flexShrink: 0, justifyContent: 'center' },
  feedback: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.xl,
    borderWidth: 3,
  },
  feedbackGood: { backgroundColor: colors.good, borderColor: colors.goodInk },
  feedbackGentle: { backgroundColor: colors.gentle, borderColor: colors.gentleInk },
  feedbackText: { flex: 1, minWidth: 0, gap: 2 },
  feedbackTitle: { ...font.display(800) },
  why: { ...font.body() },
});
