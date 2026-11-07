import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { BigButton, ReplayButton } from '../controls';
import { colors, MIN_TAP, useLayout } from '../theme';
import type { Narrate } from '../types';
import {
  LABEL_HEIGHT,
  layoutStage,
  planDeal,
  type DealPlan,
  type Point,
  type Rect,
  type ShareProblem,
} from './share';

const NATIVE = Platform.OS !== 'web';
const DEAL_MS = 420;
const GAP_MS = 120;
const RETURN_MS = 500;

type Phase = 'ask' | 'dealing' | 'result' | 'returning';

function move(value: Animated.ValueXY, to: Point, duration: number): Promise<void> {
  return new Promise((resolve) =>
    Animated.timing(value, {
      toValue: to,
      duration,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: NATIVE,
    }).start(() => resolve()),
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function questionText(p: ShareProblem): string[] {
  return [
    `${p.sharer.name} has ${p.total} ${p.thing.many}.`,
    `${p.sharer.name} shares them equally with ${p.friends.length} friends.`,
    'How many does each friend get?',
  ];
}

function resultText(
  p: ShareProblem,
  plan: DealPlan,
  each: number,
): { title: string; body: string } {
  const many = (n: number) => `${n} ${n === 1 ? p.thing.one : p.thing.many}`;
  switch (plan.result) {
    case 'fair':
      return {
        title: 'Yes! Fair share!',
        body: `Each friend gets ${many(each)}, and nothing is left over.`,
      };
    case 'leftover':
      return {
        title: 'Almost!',
        body: `${many(plan.leftover)} still left. Each friend can get more.`,
      };
    case 'short':
      return {
        title: 'Oops, we ran out!',
        body: `There are not enough ${p.thing.many} to give everyone ${each}.`,
      };
  }
}

type Props = {
  problem: ShareProblem;
  narrate?: Narrate;
  /** Called once, with the first tap's result. Retries after a miss don't count. */
  onAnswer?: (each: number, correct: boolean) => void;
  onNext?: () => void;
};

/**
 * Sharing as a play-out: the child picks how many each friend gets, and the objects move to the
 * friends one round at a time. A wrong pick shows why: objects left over, or empty spots.
 */
export function ShareGame({ problem, narrate, onAnswer, onNext }: Props) {
  const { landscape, scale } = useLayout();
  const groups = problem.friends.length;
  const answer = problem.total / groups;
  const maxEach = Math.max(...problem.choices);

  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const geo = useMemo(
    () => (stage ? layoutStage(stage.w, stage.h, problem.total, groups, maxEach) : null),
    [stage, problem.total, groups, maxEach],
  );

  const [things] = useState(() =>
    Array.from({ length: problem.total }, () => new Animated.ValueXY({ x: 0, y: 0 })),
  );
  const [cheer] = useState(() => new Animated.Value(0));
  const [phase, setPhase] = useState<Phase>('ask');
  const [picked, setPicked] = useState<number | null>(null);
  const [tried, setTried] = useState<number[]>([]);
  const [counts, setCounts] = useState<number[]>(() => Array(groups).fill(0));
  const [plan, setPlan] = useState<DealPlan | null>(null);
  // Where each object sits now: null is the sharer's plate. Read on re-layout.
  const placed = useRef<({ friend: number; slot: number } | null)[]>([]);
  const run = useRef(0);
  const lastSpoken = useRef<string[]>([]);
  const narrateRef = useRef(narrate);
  useEffect(() => {
    narrateRef.current = narrate;
  });

  const say = (texts: string[]) => {
    lastSpoken.current = texts;
    narrateRef.current?.(texts);
  };

  useEffect(() => {
    lastSpoken.current = questionText(problem);
    narrateRef.current?.(lastSpoken.current);
    const runs = run;
    return () => {
      runs.current += 1;
      things.forEach((v) => v.stopAnimation());
    };
  }, [problem, things]);

  // Snap objects to their spots whenever the stage size changes, e.g. on rotation.
  useEffect(() => {
    if (!geo) return;
    things.forEach((v, i) => {
      const at = placed.current[i];
      v.setValue(at ? geo.friends[at.friend].slots[at.slot] : geo.source[i]);
    });
  }, [geo, things]);

  const pick = async (each: number) => {
    if (phase !== 'ask' || !geo) return;
    const token = ++run.current;
    const deal = planDeal(problem.total, groups, each);
    if (tried.length === 0) onAnswer?.(each, each === answer);
    setTried((t) => [...t, each]);
    setPicked(each);
    setPlan(deal);
    setPhase('dealing');
    say([`Let's give each friend ${each}.`]);

    const tally = Array(groups).fill(0);
    for (const step of deal.steps) {
      placed.current[step.thing] = { friend: step.friend, slot: step.slot };
      await move(things[step.thing], geo.friends[step.friend].slots[step.slot], DEAL_MS);
      if (run.current !== token) return;
      tally[step.friend] += 1;
      setCounts([...tally]);
      await wait(GAP_MS);
    }

    setPhase('result');
    const { title, body } = resultText(problem, deal, each);
    say([title, body]);
    if (deal.result === 'fair') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(cheer, { toValue: 1, duration: 220, useNativeDriver: NATIVE }),
          Animated.timing(cheer, { toValue: 0, duration: 220, useNativeDriver: NATIVE }),
        ]),
        { iterations: 3 },
      ).start();
    }
  };

  const retry = async () => {
    if (!geo) return;
    const token = ++run.current;
    setPhase('returning');
    placed.current = [];
    await Promise.all(things.map((v, i) => move(v, geo.source[i], RETURN_MS)));
    if (run.current !== token) return;
    setCounts(Array(groups).fill(0));
    setPicked(null);
    setPlan(null);
    setPhase('ask');
    say(['How many does each friend get?']);
  };

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  const hop = cheer.interpolate({ inputRange: [0, 1], outputRange: [0, -14 * scale] });
  const result = plan && phase === 'result' ? resultText(problem, plan, picked!) : null;
  const fair = plan?.result === 'fair' && phase === 'result';

  const stageView = (
    <View style={styles.stage} onLayout={onStageLayout} testID="share-stage">
      {geo && (
        <>
          <View style={[styles.abs, at(geo.sharer.at), { width: geo.sharer.size }]}>
            <Text style={[styles.emoji, emojiSize(geo.sharer.size)]}>{problem.sharer.emoji}</Text>
            <Text style={styles.name}>{problem.sharer.name}</Text>
          </View>
          <View
            style={[
              styles.plate,
              rect(geo.sourcePlate),
              phase === 'result' && plan?.result === 'leftover' && styles.plateHint,
            ]}
          />
          {problem.friends.map((friend, g) => {
            const f = geo.friends[g];
            const short = phase === 'result' && plan?.result === 'short';
            return (
              <Fragment key={friend.name}>
                <Animated.View
                  style={[
                    styles.abs,
                    at(f.avatar),
                    { width: geo.avatarSize },
                    fair && { transform: [{ translateY: hop }] },
                  ]}
                >
                  <Text style={[styles.emoji, emojiSize(geo.avatarSize)]}>{friend.emoji}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {friend.name}
                  </Text>
                </Animated.View>
                <View style={[styles.plate, rect(f.plate)]} />
                {picked !== null &&
                  f.slots.slice(0, picked).map((slot, s) => (
                    <View
                      key={s}
                      style={[
                        styles.slot,
                        short && s >= counts[g] && styles.slotHint,
                        {
                          left: slot.x + 3,
                          top: slot.y + 3,
                          width: geo.size - 6,
                          height: geo.size - 6,
                        },
                      ]}
                    />
                  ))}
                <Text
                  testID={`share-count-${g}`}
                  style={[
                    styles.count,
                    {
                      left: f.plate.x,
                      width: f.plate.w,
                      top: f.plate.y + f.plate.h + 4,
                      fontSize: 22 * scale,
                    },
                  ]}
                >
                  {picked === null ? '' : counts[g]}
                </Text>
              </Fragment>
            );
          })}
          {things.map((xy, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.thing,
                {
                  width: geo.size,
                  height: geo.size,
                  fontSize: geo.size * 0.75,
                  lineHeight: geo.size,
                  transform: xy.getTranslateTransform(),
                },
              ]}
            >
              {problem.thing.emoji}
            </Animated.Text>
          ))}
        </>
      )}
    </View>
  );

  const choices = (
    <View style={[styles.choices, landscape && styles.choicesWrap]}>
      {problem.choices.map((n) => {
        const done = tried.includes(n) && n !== picked;
        const chosen = n === picked;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={String(n)}
            accessibilityState={{ disabled: phase !== 'ask' || done, selected: chosen }}
            disabled={phase !== 'ask' || done}
            onPress={() => void pick(n)}
            style={({ pressed }) => [
              styles.choice,
              { height: Math.max(MIN_TAP, 88 * scale), borderRadius: 24 * scale },
              landscape && styles.choiceHalf,
              pressed && styles.pressed,
              chosen &&
                (phase !== 'result'
                  ? styles.choiceActive
                  : fair
                    ? styles.choiceGood
                    : styles.choiceMiss),
              done && styles.faded,
            ]}
          >
            <Text style={[styles.choiceText, { fontSize: 44 * scale }]}>{n}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const feedback = result && (
    <View
      accessibilityLiveRegion="polite"
      style={[styles.feedback, fair ? styles.feedbackGood : styles.feedbackGentle]}
    >
      <Text style={[styles.feedbackIcon, { fontSize: 40 * scale }]}>{fair ? '🌟' : '🤔'}</Text>
      <View style={styles.feedbackText}>
        <Text
          style={[
            styles.feedbackTitle,
            { fontSize: 24 * scale, color: fair ? colors.goodInk : colors.gentleInk },
          ]}
        >
          {result.title}
        </Text>
        <Text style={[styles.why, { fontSize: 18 * scale }]}>{result.body}</Text>
      </View>
      {fair ? (
        <BigButton label="Next" icon="▶" onPress={() => onNext?.()} />
      ) : (
        <BigButton label="Try again" icon="↺" onPress={() => void retry()} />
      )}
    </View>
  );

  const prompt = (
    <View style={styles.promptRow}>
      <ReplayButton onPress={() => narrateRef.current?.(lastSpoken.current, { replay: true })} />
      <Text style={[styles.prompt, { fontSize: (landscape ? 20 : 22) * scale }]}>
        {questionText(problem).join(' ')}
      </Text>
    </View>
  );

  if (landscape) {
    return (
      <View style={[styles.screen, styles.row]}>
        {stageView}
        <View style={styles.side}>
          {prompt}
          {feedback ?? choices}
        </View>
      </View>
    );
  }
  return (
    <View style={styles.screen}>
      {prompt}
      {stageView}
      {/* Fixed height: the stage must not jump when feedback replaces the choices. */}
      <View style={[styles.bottom, { height: 150 * scale }]}>{feedback ?? choices}</View>
    </View>
  );
}

const at = (p: Point) => ({ left: p.x, top: p.y });
const rect = (r: Rect) => ({ left: r.x, top: r.y, width: r.w, height: r.h });
const emojiSize = (side: number) => ({ fontSize: side * 0.8, lineHeight: side });

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  row: { flexDirection: 'row' },
  side: { flex: 1, justifyContent: 'center', gap: 8, paddingVertical: 8 },
  stage: { flex: 1.4, margin: 8 },
  abs: { position: 'absolute', alignItems: 'center' },
  emoji: { textAlign: 'center' },
  name: {
    height: LABEL_HEIGHT,
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
    textAlign: 'center',
  },
  plate: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 3,
    borderColor: colors.line,
  },
  plateHint: { borderColor: colors.gentleInk, backgroundColor: colors.gentle },
  slot: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  slotHint: { borderColor: colors.gentleInk, backgroundColor: colors.gentle },
  count: { position: 'absolute', textAlign: 'center', fontWeight: '800', color: colors.ink },
  thing: { position: 'absolute', left: 0, top: 0, textAlign: 'center' },
  promptRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  prompt: { flex: 1, color: colors.ink, fontWeight: '700' },
  bottom: { justifyContent: 'center' },
  choices: { flexDirection: 'row', gap: 12, padding: 12 },
  choicesWrap: { flexWrap: 'wrap' },
  choice: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 4,
    borderColor: 'transparent',
  },
  choiceHalf: { flexBasis: '40%' },
  pressed: { transform: [{ scale: 0.96 }], backgroundColor: colors.pressed },
  choiceActive: { borderColor: colors.accent },
  choiceGood: { backgroundColor: colors.good, borderColor: colors.goodInk },
  choiceMiss: { backgroundColor: colors.gentle, borderColor: colors.gentleInk },
  faded: { opacity: 0.35 },
  choiceText: { color: colors.ink, fontWeight: '700' },
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
