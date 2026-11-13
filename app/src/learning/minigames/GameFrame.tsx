import { parseMixed, type SceneAnswer } from '@bright-trail/shared';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Icon } from '../../design/Icon';
import { color, font, pressDown, radius, shadow } from '../../design/tokens';
import { FlagButton, KidButton, ReplayButton } from '../controls';
import { Feedback } from '../ItemFrame';
import { QuitButton } from '../quit';
import { pressKey } from '../KeypadItemView';
import { colors, CORRECT_TEXT, MIN_TAP, MISS_TEXT, useLayout } from '../theme';
import type { ItemProgress, Narrate } from '../types';
import { ProgressDots } from '../../design/kid';
import { ReadAlong } from '../ReadAlong';
import { AmountText } from './AmountText';
import { useDrag } from '../drag';
import { Text } from '../../design/Text';

/** A choice's value. Text the story can't show as a number, like "Same", stays text. */
export type GameValue = SceneAnswer | string;
export type GameChoice = { id: string; label: string; value: GameValue };
export type GameInput =
  | { kind: 'choices'; choices: GameChoice[] }
  /** `decimal` adds a decimal point key, for decimal answers only. */
  | { kind: 'keypad'; decimal?: boolean };

type Phase = 'ask' | 'playing' | 'result' | 'resetting';
type Outcome = { correct: boolean; title: string; body: string };

export const sameAnswer = (a: GameValue, b: GameValue) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;

export type GameFrameProps = {
  /** Screen text. */
  prompt: string;
  /** Spoken on start. */
  question: string[];
  /** A number or yes-no, or the right choice's label when it's a word like "Liquid". */
  answer: GameValue;
  input: GameInput;
  /** Practice lets the child try again after a miss. Measuring shows why, then moves on. */
  retry: boolean;
  narrate?: Narrate;
  /** Called once, for the first answer. Retries don't count. */
  onAnswer?: (
    picked: { value: GameValue; choiceId?: string },
    correct: boolean,
    replays: number,
  ) => void;
  onFlag?: () => void;
  onNext?: () => void;
  progress?: ItemProgress;
};

type Props = GameFrameProps & {
  /** The play area. `cheer` is true after a right answer. */
  stage: (state: {
    cheer: boolean;
    /** Answers with a choice's label, for a stage that takes drops. `undefined` once answered. */
    pick: ((label: string) => void) | undefined;
  }) => ReactNode;
  /** Lets a choice be dragged as well as tapped. Says whether a screen point is a drop spot. */
  onDropChoice?: (pageX: number, pageY: number) => Promise<boolean>;
  /** Plays the story out for the child's answer. Returns what to say about it. */
  playOut: (value: GameValue, correct: boolean, label: string) => Promise<string>;
  /** Puts the stage back for another try. */
  reset: () => Promise<void>;
};

/**
 * The frame every minigame shares: the prompt, the answer choices or keypad, the play-out after
 * the first answer, and the feedback with Next or Try again.
 */
export function GameFrame(props: Props) {
  const { input, answer, retry } = props;
  const { landscape, scale } = useLayout();
  const typed = input.kind === 'keypad';

  const [phase, setPhase] = useState<Phase>('ask');
  const [tried, setTried] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [cheer, setCheer] = useState(false);
  const [entry, setEntry] = useState('');

  const answered = useRef(false);
  const replays = useRef(0);
  const lastSpoken = useRef<string[]>([]);
  const narrateRef = useRef(props.narrate);
  const onAnswerRef = useRef(props.onAnswer);
  const questionRef = useRef(props.question);
  useEffect(() => {
    narrateRef.current = props.narrate;
    onAnswerRef.current = props.onAnswer;
  });
  const say = (texts: string[]) => {
    lastSpoken.current = texts;
    narrateRef.current?.(texts);
  };

  useEffect(() => {
    lastSpoken.current = questionRef.current;
    narrateRef.current?.(lastSpoken.current);
  }, []);

  const choose = async (value: GameValue, label: string, choiceId?: string) => {
    if (phase !== 'ask') return;
    const correct = sameAnswer(value, answer);
    setPicked(label);
    setTried((t) => [...t, label]);
    setPhase('playing');
    if (!answered.current) {
      answered.current = true;
      onAnswerRef.current?.({ value, choiceId }, correct, replays.current);
    }
    say([`${label}? Let's see.`]);
    const body = await props.playOut(value, correct, label);
    // The same titles as every other item, so feedback feels the same across the app.
    const result = { correct, title: correct ? CORRECT_TEXT : MISS_TEXT, body };
    setOutcome(result);
    setCheer(correct);
    setPhase('result');
    say([result.title, result.body]);
  };

  // The stage calls this from a drop, so it reads the latest `choose` through a holder.
  const chooseRef = useRef(choose);
  useEffect(() => {
    chooseRef.current = choose;
  });
  const pick =
    phase === 'ask' && input.kind === 'choices'
      ? (label: string) => {
          const c = input.choices.find((x) => x.label === label);
          if (c && !tried.includes(c.label)) void chooseRef.current(c.value, c.label, c.id);
        }
      : undefined;

  const tryAgain = async () => {
    setPhase('resetting');
    setOutcome(null);
    setCheer(false);
    await props.reset();
    setPicked(null);
    setEntry('');
    setPhase('ask');
    say(questionRef.current);
  };

  const replay = () => {
    if (!answered.current) replays.current += 1;
    narrateRef.current?.(lastSpoken.current, { replay: true });
  };

  const tileHeight = Math.max(MIN_TAP, (landscape ? 72 : 88) * scale);
  const inputView =
    input.kind === 'choices' ? (
      <View style={[styles.choices, landscape && styles.wrap]}>
        {input.choices.map((c) => {
          const chosen = c.label === picked;
          const done = tried.includes(c.label) && !chosen;
          return (
            <DragTile
              key={c.id}
              enabled={phase === 'ask' && !done && props.onDropChoice !== undefined}
              onDrop={props.onDropChoice}
              onLanded={() => void choose(c.value, c.label, c.id)}
              style={[styles.tile, landscape && styles.half]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={c.label}
                accessibilityState={{ disabled: phase !== 'ask' || done, selected: chosen }}
                disabled={phase !== 'ask' || done}
                onPress={() => void choose(c.value, c.label, c.id)}
                style={({ pressed }) => [
                  styles.choice,
                  { height: tileHeight, borderRadius: radius.lg },
                  landscape && styles.half,
                  pressed && pressDown,
                  chosen &&
                    (phase !== 'result'
                      ? styles.choiceActive
                      : outcome?.correct
                        ? styles.choiceGood
                        : styles.choiceMiss),
                  done && styles.faded,
                ]}
              >
                {parseMixed(c.label) !== null ? (
                  <AmountText label={c.label} size={(c.label.length > 4 ? 32 : 40) * scale} />
                ) : (
                  <Text style={[styles.text, { fontSize: 22 * scale }]}>{c.label}</Text>
                )}
              </Pressable>
            </DragTile>
          );
        })}
      </View>
    ) : (
      <NumberPad
        entry={entry}
        scale={scale}
        decimal={input.decimal ?? false}
        disabled={phase !== 'ask'}
        onKey={(k) => setEntry((e) => pressKey(e, k))}
        onSubmit={() => void choose(Number(entry), entry)}
      />
    );

  const feedback = outcome && phase === 'result' && (
    <Feedback
      correct={outcome.correct}
      title={outcome.title}
      why={outcome.body}
      showWhy
      action={
        outcome.correct || !retry ? (
          <KidButton label="Next" icon="next" onPress={() => props.onNext?.()} />
        ) : (
          <KidButton label="Try again" icon="refresh" onPress={() => void tryAgain()} />
        )
      }
    />
  );

  const top = (
    <View>
      {props.progress && <ProgressDots steps noun="Question" {...props.progress} />}
      <View style={styles.promptRow}>
        <ReplayButton onPress={replay} />
        <Text
          style={[
            styles.prompt,
            { fontSize: (landscape ? 20 : 24) * scale, lineHeight: (landscape ? 24 : 28) * scale },
          ]}
        >
          {props.prompt}
        </Text>
        <View style={styles.topRight}>
          <QuitButton />
          <FlagButton onFlag={props.onFlag} />
        </View>
      </View>
      {/* The question as spoken, without picture labels the choices already show. */}
      <ReadAlong text={props.question[0]} lines={landscape ? 4 : 2.5} />
    </View>
  );

  // eslint-disable-next-line react-hooks/refs -- `pick` reads refs only when called.
  const stageView = props.stage({ cheer, pick });
  const stage = <View style={styles.stages}>{stageView}</View>;
  const bottom = feedback || inputView;

  if (landscape) {
    return (
      <View style={[styles.screen, styles.row]}>
        {stage}
        <View style={styles.side}>
          {top}
          {bottom}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      {top}
      {stage}
      {/* Fixed height: the stage must not jump when feedback replaces the input. */}
      <View style={[styles.bottom, { height: (typed ? 200 : 150) * scale }]}>{bottom}</View>
    </View>
  );
}

type DragTileProps = {
  enabled: boolean;
  onDrop?: (pageX: number, pageY: number) => Promise<boolean>;
  onLanded: () => void;
  style: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Wraps a choice so a drag past `DRAG_SLOP` carries it. A tap still reaches the button. */
function DragTile({ enabled, onDrop, onLanded, style, children }: DragTileProps) {
  const [pan] = useState(() => new Animated.ValueXY());
  const back = () =>
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  const drag = useDrag({
    enabled,
    grab: 'move',
    onMove: (p) => pan.setValue({ x: p.dx, y: p.dy }),
    onDrop: (p) => {
      void (onDrop ? onDrop(p.pageX, p.pageY) : Promise.resolve(false)).then((ok) => {
        if (ok) {
          pan.setValue({ x: 0, y: 0 });
          onLanded();
        } else back();
      });
    },
    onCancel: back,
  });
  return (
    <Animated.View {...drag} style={[style, { transform: pan.getTranslateTransform(), zIndex: 1 }]}>
      {children}
    </Animated.View>
  );
}

const PAD_KEYS = [
  ['1', '2', '3', '4', '5', '⌫'],
  ['6', '7', '8', '9', '0', '✔'],
];
// Six keys a row still fit a small phone, so the check key moves up beside the answer.
const DECIMAL_KEYS = [
  ['1', '2', '3', '4', '5', '.'],
  ['6', '7', '8', '9', '0', '⌫'],
];

const keyLabel = (k: string) =>
  k === '✔' ? 'Check my answer' : k === '⌫' ? 'Delete' : k === '.' ? 'Decimal point' : k;

/** Whole numbers, or decimals, on two rows of keys, short enough to sit under the stage. */
function NumberPad({
  entry,
  scale,
  decimal,
  disabled,
  onKey,
  onSubmit,
}: {
  entry: string;
  scale: number;
  decimal: boolean;
  disabled: boolean;
  onKey: (key: string) => void;
  onSubmit: () => void;
}) {
  const side = Math.max(MIN_TAP * 0.85, 52 * scale);
  const key = (k: string) => {
    const submit = k === '✔';
    const off = disabled || (submit && entry === '');
    return (
      <Pressable
        key={k}
        accessibilityRole="button"
        accessibilityLabel={keyLabel(k)}
        accessibilityState={{ disabled: off }}
        disabled={off}
        onPress={() => (submit ? onSubmit() : onKey(k))}
        style={({ pressed }) => [
          styles.key,
          { width: side, height: side, borderRadius: radius.md },
          submit && styles.submit,
          pressed && pressDown,
          off && styles.faded,
        ]}
      >
        {submit ? (
          <Icon name="check" size={side * 0.55} tint={color.onTrail} stroke={3.2} />
        ) : k === '⌫' ? (
          <Icon name="backspace" size={side * 0.5} tint={colors.ink} />
        ) : (
          <Text style={[styles.text, { fontSize: side * 0.5 }]}>{k}</Text>
        )}
      </Pressable>
    );
  };
  return (
    <View style={styles.pad}>
      <View style={styles.padRow}>
        <View
          accessible
          accessibilityLabel={entry ? `Your answer, ${entry}` : 'Your answer, empty'}
          style={[styles.display, { height: side * 0.9, minWidth: side * 2 }]}
        >
          <Text style={[styles.text, { fontSize: side * 0.5 }, !entry && styles.empty]}>
            {entry || '?'}
          </Text>
        </View>
        {decimal && key('✔')}
      </View>
      {(decimal ? DECIMAL_KEYS : PAD_KEYS).map((row, r) => (
        <View key={r} style={styles.padRow}>
          {row.map(key)}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row' },
  side: { flex: 1, justifyContent: 'center', gap: 8, paddingVertical: 8 },
  stages: { flex: 1.4 },
  topRight: { flexDirection: 'row' },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  prompt: { flex: 1, ...font.display(700), color: colors.ink, textAlign: 'center' },
  bottom: { justifyContent: 'center' },
  tile: { flex: 1 },
  choices: { flexDirection: 'row', gap: 12, padding: 12 },
  wrap: { flexWrap: 'wrap' },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 3,
    borderColor: colors.line,
    paddingHorizontal: 4,
    ...shadow.ledge,
  },
  half: { flexBasis: '40%' },
  choiceActive: { borderColor: colors.accent, boxShadow: 'none' },
  choiceGood: { backgroundColor: colors.good, borderColor: colors.goodInk, boxShadow: 'none' },
  choiceMiss: { backgroundColor: colors.gentle, borderColor: colors.gentleInk, boxShadow: 'none' },
  faded: { opacity: 0.35, boxShadow: 'none' },
  text: { ...font.display(700), color: colors.ink, textAlign: 'center' },
  pad: { alignItems: 'center', gap: 6, padding: 6 },
  padRow: { flexDirection: 'row', gap: 6 },
  display: {
    borderRadius: radius.lg,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: colors.raised,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  key: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    ...shadow.ledge,
  },
  submit: { backgroundColor: colors.accent, ...shadow.ledgeTrail },
  empty: { color: colors.softInk },
});
