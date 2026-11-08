import {
  formatAmount,
  parseMixed,
  toAmount,
  type Amount,
  type SceneAnswer,
} from '@bright-trail/shared';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BigButton, FlagButton, ReplayButton } from '../controls';
import { pressKey } from '../KeypadItemView';
import { colors, CORRECT_TEXT, MIN_TAP, MISS_TEXT, useLayout } from '../theme';
import type { Narrate } from '../types';
import { AmountText } from './AmountText';
import { slotsFor, type ShareProblem, type Side } from './share';
import { Stage, type StageHandle, type Tone } from './Stage';

export type ShareChoice = { id: string; label: string; value: SceneAnswer };
export type ShareInput = { kind: 'choices'; choices: ShareChoice[] } | { kind: 'keypad' };

type Phase = 'ask' | 'playing' | 'result' | 'resetting';
type Outcome = { correct: boolean; title: string; body: string };
type StageLook = {
  outline?: Pick<Amount, 'whole' | 'parts' | 'den'> | null;
  hint?: { source?: boolean; emptySpots?: boolean; receivers?: (Tone | null)[] };
  counts?: boolean;
};

const same = (a: SceneAnswer, b: SceneAnswer) =>
  typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) < 1e-9 : a === b;

const PLURALS: Record<string, string> = { box: 'boxes' };
const plural = (word: string) => PLURALS[word] ?? `${word}s`;

/** What to call the receivers: friends, stores, or the container itself. */
function receiverWord(p: ShareProblem, count: number): string {
  const first = p.side.receivers[0];
  const one = first?.name ? 'friend' : first?.emoji ? 'store' : p.container;
  return count === 1 ? one : plural(one);
}

/** "1 cookie", "2 1/2 cookies", "3/4 of a pie". */
function howMuch(p: ShareProblem, value: number): string {
  if (value === 1) return `1 ${p.thing.one}`;
  if (value < 1) return `${formatAmount(value)} of a ${p.thing.one}`;
  return `${formatAmount(value)} ${p.thing.many}`;
}

const nameOf = (side: Side, r: number) => side.receivers[r].name ?? (r === 0 ? 'One' : 'one');

type Props = {
  problem: ShareProblem;
  /** Screen text. */
  prompt: string;
  /** Spoken on start. */
  question: string[];
  answer: SceneAnswer;
  input: ShareInput;
  /** Practice lets the child try again after a miss. Measuring shows why, then moves on. */
  retry: boolean;
  narrate?: Narrate;
  /** Called once, for the first answer. Retries don't count. */
  onAnswer?: (
    picked: { value: SceneAnswer; choiceId?: string },
    correct: boolean,
    replays: number,
  ) => void;
  onFlag?: () => void;
  onNext?: () => void;
};

/**
 * A sharing story played out. The child answers, then the things move so the child sees why the
 * answer is right or not: leftovers, empty spots, groups filling up, or counts.
 */
export function ShareGame(props: Props) {
  const { problem: p, input, answer, retry } = props;
  const { landscape, scale } = useLayout();
  const groups = p.side.receivers.length;
  const typed = input.kind === 'keypad';
  const numbers =
    input.kind === 'choices'
      ? input.choices.map((c) => c.value).filter((v): v is number => typeof v === 'number')
      : typeof answer === 'number'
        ? [answer]
        : [];
  const slotsEach = slotsFor(p, numbers, typed);

  const stage = useRef<StageHandle>(null);
  const otherStage = useRef<StageHandle>(null);
  const [phase, setPhase] = useState<Phase>('ask');
  const [tried, setTried] = useState<string[]>([]);
  const [picked, setPicked] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [look, setLook] = useState<StageLook>({ counts: p.ask === 'total' });
  const [otherLook, setOtherLook] = useState<StageLook>({});
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

  /** Plays the story out for the child's answer and says what happened. */
  const playOut = async (value: SceneAnswer): Promise<Outcome> => {
    const correct = same(value, answer);
    const s = stage.current!;
    const word = (n: number) => receiverWord(p, n);
    // The same titles as every other item, so feedback feels the same across the app.
    const title = correct ? CORRECT_TEXT : MISS_TEXT;
    switch (p.ask) {
      case 'each': {
        const amount = toAmount(value as number)!;
        setLook({ outline: amount, counts: true });
        const plan = await s.deal(amount);
        const left = plan.left.wholes + plan.left.pieces / plan.left.den;
        setLook({
          outline: amount,
          counts: true,
          hint: { source: plan.result === 'leftover', emptySpots: plan.result === 'short' },
        });
        if (plan.result === 'fair') {
          return {
            correct,
            title,
            body: `Fair share! Each ${word(1)} gets ${howMuch(p, amount.value)}, and nothing is left over.`,
          };
        }
        if (plan.result === 'leftover') {
          return {
            correct,
            title,
            body: `Almost! ${howMuch(p, left)} still left. Each ${word(1)} can get more.`,
          };
        }
        return {
          correct,
          title,
          body: `We ran out! There is not enough to give each ${word(1)} ${amount.label}.`,
        };
      }
      case 'left': {
        const each = toAmount(Math.floor(p.total / groups))!;
        setLook({ outline: each, counts: true });
        await s.deal(each);
        const left = await s.countLeft();
        setLook({ outline: each, counts: true, hint: { source: left > 0 } });
        return {
          correct,
          title,
          body: `Each ${word(1)} gets ${each.value}, and ${left} ${left === 1 ? 'is' : 'are'} left over.`,
        };
      }
      case 'groups': {
        setLook({ outline: toAmount(p.each!), counts: true });
        await s.fill(p.each!);
        return {
          correct,
          title,
          body: `${p.total} ${p.thing.many}, ${p.each} in each. That fills ${groups} ${word(groups)}.`,
        };
      }
      case 'total': {
        await s.collect();
        return {
          correct,
          title,
          body: `${groups} ${word(groups)} with ${p.each} each make ${p.total} ${p.thing.many} in all.`,
        };
      }
      case 'fair': {
        setLook({ counts: true });
        await s.countUp();
        const split = p.split!;
        const equal = split.every((n) => n === split[0]);
        setLook({
          counts: true,
          hint: { receivers: split.map(() => (equal ? 'good' : 'gentle')) },
        });
        return {
          correct,
          title,
          body: equal
            ? `Everyone has ${split[0]}. That is fair.`
            : `${split.map((n, r) => `${nameOf(p.side, r)} has ${n}`).join(', ')}. That is not fair.`,
        };
      }
      case 'compare': {
        const other = p.other!;
        const n = other.receivers.length;
        const mine = p.total / groups;
        const theirs = p.total / n;
        setLook({ outline: toAmount(mine), counts: true });
        setOtherLook({ outline: toAmount(theirs), counts: true });
        await Promise.all([s.deal(toAmount(mine)!), otherStage.current!.deal(toAmount(theirs)!)]);
        const firstWins = p.want === 'more' ? mine > theirs : mine < theirs;
        const tone = (win: boolean): Tone => (win ? 'good' : 'gentle');
        setLook({
          outline: toAmount(mine),
          counts: true,
          hint: { receivers: Array(groups).fill(tone(firstWins)) },
        });
        setOtherLook({
          outline: toAmount(theirs),
          counts: true,
          hint: { receivers: Array(n).fill(tone(!firstWins)) },
        });
        return {
          correct,
          title,
          body: `With ${groups} ${word(groups)}, each gets ${howMuch(p, mine)}. With ${n}, each gets ${howMuch(p, theirs)}.`,
        };
      }
    }
  };

  const choose = async (value: SceneAnswer, label: string, choiceId?: string) => {
    if (phase !== 'ask') return;
    setPicked(label);
    setTried((t) => [...t, label]);
    setPhase('playing');
    if (!answered.current) {
      answered.current = true;
      onAnswerRef.current?.({ value, choiceId }, same(value, answer), replays.current);
    }
    say([`${label}? Let's see.`]);
    const result = await playOut(value);
    setOutcome(result);
    setCheer(result.correct);
    setPhase('result');
    say([result.title, result.body]);
  };

  const tryAgain = async () => {
    setPhase('resetting');
    setOutcome(null);
    setCheer(false);
    await Promise.all([stage.current?.reset(), otherStage.current?.reset()]);
    setLook({ counts: p.ask === 'total' });
    setOtherLook({});
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
            <Pressable
              key={c.id}
              accessibilityRole="button"
              accessibilityLabel={c.label}
              accessibilityState={{ disabled: phase !== 'ask' || done, selected: chosen }}
              disabled={phase !== 'ask' || done}
              onPress={() => void choose(c.value, c.label, c.id)}
              style={({ pressed }) => [
                styles.choice,
                { height: tileHeight, borderRadius: 24 * scale },
                landscape && styles.half,
                pressed && styles.pressed,
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
          );
        })}
      </View>
    ) : (
      <NumberPad
        entry={entry}
        scale={scale}
        disabled={phase !== 'ask'}
        onKey={(k) => setEntry((e) => pressKey(e, k))}
        onSubmit={() => void choose(Number(entry), entry)}
      />
    );

  const feedback = outcome && phase === 'result' && (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.feedback, outcome.correct ? styles.feedbackGood : styles.feedbackGentle]}
    >
      <Text style={[styles.feedbackIcon, { fontSize: 40 * scale }]}>
        {outcome.correct ? '🌟' : '🤔'}
      </Text>
      <View style={styles.feedbackText}>
        <Text
          style={[
            styles.feedbackTitle,
            { fontSize: 24 * scale, color: outcome.correct ? colors.goodInk : colors.gentleInk },
          ]}
        >
          {outcome.title}
        </Text>
        <Text style={[styles.why, { fontSize: 18 * scale }]}>{outcome.body}</Text>
      </View>
      {outcome.correct || !retry ? (
        <BigButton label="Next" icon="▶" onPress={() => props.onNext?.()} />
      ) : (
        <BigButton label="Try again" icon="↺" onPress={() => void tryAgain()} />
      )}
    </View>
  );

  const top = (
    <View style={styles.promptRow}>
      <ReplayButton onPress={replay} />
      <Text style={[styles.prompt, { fontSize: (landscape ? 20 : 24) * scale }]}>
        {props.prompt}
      </Text>
      <FlagButton onFlag={props.onFlag} />
    </View>
  );

  const start =
    p.ask === 'total'
      ? Array<number>(groups).fill(p.each!)
      : p.ask === 'fair'
        ? p.split
        : undefined;
  const shared = {
    thing: p.thing,
    container: p.container,
    total: p.total,
    slotsEach,
    scale,
    start,
    hideEmpty: p.ask === 'groups',
    noSource: p.ask === 'fair',
    cheer,
  };
  const stages = (
    <View style={styles.stages}>
      <Stage handle={stage} side={p.side} {...shared} {...look} />
      {p.other && <Stage handle={otherStage} side={p.other} {...shared} {...otherLook} />}
    </View>
  );
  const bottom = feedback || inputView;

  if (landscape) {
    return (
      <View style={[styles.screen, styles.row]}>
        {stages}
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
      {stages}
      {/* Fixed height: the stage must not jump when feedback replaces the input. */}
      <View style={[styles.bottom, { height: (typed ? 200 : 150) * scale }]}>{bottom}</View>
    </View>
  );
}

const PAD_KEYS = [
  ['1', '2', '3', '4', '5', '⌫'],
  ['6', '7', '8', '9', '0', '✔'],
];

/** Whole numbers on two rows of keys, short enough to sit under the stage. */
function NumberPad({
  entry,
  scale,
  disabled,
  onKey,
  onSubmit,
}: {
  entry: string;
  scale: number;
  disabled: boolean;
  onKey: (key: string) => void;
  onSubmit: () => void;
}) {
  const side = Math.max(MIN_TAP * 0.85, 52 * scale);
  return (
    <View style={styles.pad}>
      <View
        accessible
        accessibilityLabel={entry ? `Your answer, ${entry}` : 'Your answer, empty'}
        style={[styles.display, { height: side * 0.9, minWidth: side * 2 }]}
      >
        <Text style={[styles.text, { fontSize: side * 0.5 }]}>{entry || ' '}</Text>
      </View>
      {PAD_KEYS.map((row, r) => (
        <View key={r} style={styles.padRow}>
          {row.map((k) => {
            const submit = k === '✔';
            const off = disabled || (submit && entry === '');
            return (
              <Pressable
                key={k}
                accessibilityRole="button"
                accessibilityLabel={submit ? 'Check my answer' : k === '⌫' ? 'Delete' : k}
                accessibilityState={{ disabled: off }}
                disabled={off}
                onPress={() => (submit ? onSubmit() : onKey(k))}
                style={({ pressed }) => [
                  styles.key,
                  { width: side, height: side, borderRadius: side / 2.5 },
                  submit && styles.submit,
                  pressed && styles.pressed,
                  off && styles.faded,
                ]}
              >
                <Text style={[styles.text, { fontSize: side * 0.45 }]}>{k}</Text>
              </Pressable>
            );
          })}
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
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8 },
  prompt: { flex: 1, color: colors.ink, fontWeight: '700', textAlign: 'center' },
  bottom: { justifyContent: 'center' },
  choices: { flexDirection: 'row', gap: 12, padding: 12 },
  wrap: { flexWrap: 'wrap' },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: 'transparent',
    paddingHorizontal: 4,
  },
  half: { flexBasis: '40%' },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: colors.pressed },
  choiceActive: { borderColor: colors.accent },
  choiceGood: { backgroundColor: colors.good, borderColor: colors.goodInk },
  choiceMiss: { backgroundColor: colors.gentle, borderColor: colors.gentleInk },
  faded: { opacity: 0.35 },
  text: { color: colors.ink, fontWeight: '700', textAlign: 'center' },
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
  pad: { alignItems: 'center', gap: 6, padding: 6 },
  padRow: { flexDirection: 'row', gap: 6 },
  display: {
    borderRadius: 16,
    borderWidth: 3,
    borderColor: colors.line,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  key: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  submit: { backgroundColor: colors.accent },
});
