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
import { AmountText } from './AmountText';
import { Container } from './Container';
import {
  formatPieces,
  LABEL_HEIGHT,
  layoutStage,
  parseAmount,
  planDeal,
  type Amount,
  type DealPlan,
  type Point,
  type ShareProblem,
} from './share';

const NATIVE = Platform.OS !== 'web';
const DEAL_MS = 420;
const GAP_MS = 120;
const CUT_MS = 350;
const RETURN_MS = 500;
/** Gap between the pieces of a cut object on the sharer's plate. */
const CUT_GAP = 4;

type Phase = 'ask' | 'dealing' | 'result' | 'returning';
type Spot = { friend: number; slot: number; at: number };
/** What a friend has so far: whole objects and pieces. */
type Share = { wholes: number; pieces: number };

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
const noShares = (n: number): Share[] =>
  Array.from({ length: n }, () => ({ wholes: 0, pieces: 0 }));

export function questionText(p: ShareProblem): string[] {
  return [
    `${p.sharer.name} has ${p.total} ${p.total === 1 ? p.thing.one : p.thing.many}.`,
    `${p.sharer.name} shares them equally with ${p.friends.length} friends.`,
    howManyQuestion(p),
  ];
}

const howManyQuestion = (p: ShareProblem) =>
  p.choices.some((c) => c.includes('/'))
    ? 'How much does each friend get?'
    : 'How many does each friend get?';

/** "1 cookie", "2 1/2 cookies", "3/4 of a pie". */
function howMuch(p: ShareProblem, pieces: number): string {
  const den = p.friends.length;
  if (pieces < den) return `${formatPieces(pieces, den)} of a ${p.thing.one}`;
  if (pieces === den) return `1 ${p.thing.one}`;
  return `${formatPieces(pieces, den)} ${p.thing.many}`;
}

function resultText(p: ShareProblem, plan: DealPlan, each: Amount) {
  switch (plan.result) {
    case 'fair':
      return {
        title: 'Yes! Fair share!',
        body: `Each friend gets ${howMuch(p, each.pieces)}, and nothing is left over.`,
      };
    case 'leftover':
      return {
        title: 'Almost!',
        body: `${howMuch(p, plan.leftover)} still left. Each friend can get more.`,
      };
    case 'short':
      return {
        title: 'Oops, we ran out!',
        body: `There is not enough to give everyone ${each.label}.`,
      };
  }
}

type Props = {
  problem: ShareProblem;
  narrate?: Narrate;
  /** Called once, with the first tap's result. Retries after a miss don't count. */
  onAnswer?: (each: string, correct: boolean) => void;
  onNext?: () => void;
};

/**
 * Sharing as a play-out: the child picks how much each friend gets, and the objects move to the
 * friends one round at a time. Leftovers get cut into one piece per friend. A wrong pick shows
 * why: objects left over, or empty spots.
 */
export function ShareGame({ problem, narrate, onAnswer, onNext }: Props) {
  const { landscape, scale } = useLayout();
  const groups = problem.friends.length;
  const amounts = useMemo(
    () => problem.choices.map((c) => parseAmount(c, groups, problem.thing.cuttable)),
    [problem.choices, groups, problem.thing.cuttable],
  );
  // Whole slots plus one part slot when any choice has a fraction.
  const slotsEach = Math.max(...amounts.map((a) => Math.ceil(a.pieces / groups)));

  const [stage, setStage] = useState<{ w: number; h: number } | null>(null);
  const geo = useMemo(
    () => (stage ? layoutStage(stage.w, stage.h, problem.total, groups, slotsEach) : null),
    [stage, problem.total, groups, slotsEach],
  );
  const pieceW = geo ? geo.size / groups : 0;

  const [wholes] = useState(() =>
    Array.from({ length: problem.total }, () => new Animated.ValueXY({ x: 0, y: 0 })),
  );
  const [pieces] = useState(() =>
    Array.from({ length: problem.total }, () =>
      Array.from({ length: groups }, () => new Animated.ValueXY({ x: 0, y: 0 })),
    ),
  );
  const [cheer] = useState(() => new Animated.Value(0));
  const [phase, setPhase] = useState<Phase>('ask');
  const [picked, setPicked] = useState<Amount | null>(null);
  const [tried, setTried] = useState<string[]>([]);
  const [shares, setShares] = useState<Share[]>(() => noShares(groups));
  const [cut, setCut] = useState<boolean[]>(() => Array(problem.total).fill(false));
  // Which strip of the picture a landed piece shows. A piece takes the strip of the spot it lands
  // on, so a friend's pieces join into one part of an object instead of repeating a strip.
  const [strips, setStrips] = useState<Record<string, number>>({});
  const [plan, setPlan] = useState<DealPlan | null>(null);
  // Where wholes and pieces sit now, read on re-layout. Missing means the sharer's plate.
  const placed = useRef(new Map<string, Spot>());
  const cutNow = useRef<boolean[]>([]);
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
      wholes.forEach((v) => v.stopAnimation());
      pieces.flat().forEach((v) => v.stopAnimation());
    };
  }, [problem, wholes, pieces]);

  const spotPoint = (s: Spot, piece: boolean): Point => {
    const slot = geo!.friends[s.friend].slots[s.slot];
    return piece ? { x: slot.x + s.at * pieceW, y: slot.y } : slot;
  };
  /** A piece on the sharer's plate, spread apart once cut. */
  const pieceHome = (t: number, i: number, spread: boolean): Point => {
    const src = geo!.source[t];
    const gap = spread ? (i - (groups - 1) / 2) * CUT_GAP : 0;
    return { x: src.x + i * pieceW + gap, y: src.y };
  };

  // Snap everything to its spot whenever the stage size changes, e.g. on rotation.
  useEffect(() => {
    if (!geo) return;
    const w = geo.size / groups;
    const spot = (s: Spot) => geo.friends[s.friend].slots[s.slot];
    wholes.forEach((v, t) => {
      const s = placed.current.get(`w${t}`);
      v.setValue(s ? spot(s) : geo.source[t]);
    });
    pieces.forEach((row, t) =>
      row.forEach((v, i) => {
        const s = placed.current.get(`p${t}:${i}`);
        const src = geo.source[t];
        const gap = cutNow.current[t] ? (i - (groups - 1) / 2) * CUT_GAP : 0;
        v.setValue(
          s ? { x: spot(s).x + s.at * w, y: spot(s).y } : { x: src.x + i * w + gap, y: src.y },
        );
      }),
    );
  }, [geo, wholes, pieces, groups]);

  const pick = async (each: Amount) => {
    if (phase !== 'ask' || !geo) return;
    const token = ++run.current;
    const deal = planDeal(problem.total, groups, each.pieces);
    if (tried.length === 0) onAnswer?.(each.label, each.pieces === problem.total);
    setTried((t) => [...t, each.label]);
    setPicked(each);
    setPlan(deal);
    setPhase('dealing');
    say([`Let's give each friend ${each.label}.`]);

    const tally = noShares(groups);
    for (const step of deal.steps) {
      if (step.kind === 'cut') {
        pieces[step.thing].forEach((v, i) => v.setValue(pieceHome(step.thing, i, false)));
        cutNow.current[step.thing] = true;
        setCut([...cutNow.current]);
        await Promise.all(
          pieces[step.thing].map((v, i) => move(v, pieceHome(step.thing, i, true), CUT_MS)),
        );
      } else if (step.kind === 'whole') {
        const spot = { friend: step.friend, slot: step.slot, at: 0 };
        placed.current.set(`w${step.thing}`, spot);
        await move(wholes[step.thing], spotPoint(spot, false), DEAL_MS);
        tally[step.friend].wholes += 1;
      } else {
        const spot = { friend: step.friend, slot: step.slot, at: step.at };
        placed.current.set(`p${step.thing}:${step.piece}`, spot);
        await move(pieces[step.thing][step.piece], spotPoint(spot, true), DEAL_MS);
        tally[step.friend].pieces += 1;
        setStrips((m) => ({ ...m, [`${step.thing}:${step.piece}`]: step.at }));
      }
      if (run.current !== token) return;
      setShares(tally.map((s) => ({ ...s })));
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
    placed.current.clear();
    await Promise.all([
      ...wholes.map((v, t) => move(v, geo.source[t], RETURN_MS)),
      ...pieces.flatMap((row, t) => row.map((v, i) => move(v, pieceHome(t, i, false), RETURN_MS))),
    ]);
    if (run.current !== token) return;
    cutNow.current = [];
    setCut(Array(problem.total).fill(false));
    setStrips({});
    setShares(noShares(groups));
    setPicked(null);
    setPlan(null);
    setPhase('ask');
    say([howManyQuestion(problem)]);
  };

  const onStageLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStage((s) => (s && s.w === width && s.h === height ? s : { w: width, h: height }));
  };

  const hop = cheer.interpolate({ inputRange: [0, 1], outputRange: [0, -14 * scale] });
  const result = plan && picked && phase === 'result' ? resultText(problem, plan, picked) : null;
  const fair = plan?.result === 'fair' && phase === 'result';
  const short = plan?.result === 'short' && phase === 'result';
  const wholeEach = picked ? Math.floor(picked.pieces / groups) : 0;
  const partsEach = picked ? picked.pieces % groups : 0;

  const objectText = (size: number) => ({
    width: size,
    height: size,
    fontSize: size * 0.75,
    lineHeight: size,
  });

  const stageView = (
    <View style={styles.stage} onLayout={onStageLayout} testID="share-stage">
      {geo && (
        <>
          <View style={[styles.abs, at(geo.sharer.at), { width: geo.sharer.size }]}>
            <Text style={[styles.emoji, emojiSize(geo.sharer.size)]}>{problem.sharer.emoji}</Text>
            <Text style={styles.name}>{problem.sharer.name}</Text>
          </View>
          <Container
            kind={problem.container}
            rect={geo.sourcePlate}
            hint={phase === 'result' && plan?.result === 'leftover'}
          />
          {problem.friends.map((friend, g) => {
            const f = geo.friends[g];
            const has = shares[g];
            const part = f.slots[wholeEach];
            return (
              <Fragment key={friend.name}>
                <Animated.View
                  style={[
                    styles.abs,
                    {
                      left: f.avatar.x + geo.avatarSize / 2 - geo.columnWidth / 2,
                      top: f.avatar.y,
                    },
                    { width: geo.columnWidth },
                    fair && { transform: [{ translateY: hop }] },
                  ]}
                >
                  <Text style={[styles.emoji, emojiSize(geo.avatarSize)]}>{friend.emoji}</Text>
                  <Text style={styles.name} numberOfLines={1}>
                    {friend.name}
                  </Text>
                </Animated.View>
                <Container kind={problem.container} rect={f.plate} />
                {f.slots.slice(0, wholeEach).map((slot, s) => (
                  <View
                    key={s}
                    style={[
                      styles.slot,
                      short && s >= has.wholes && styles.slotHint,
                      {
                        left: slot.x + 3,
                        top: slot.y + 3,
                        width: geo.size - 6,
                        height: geo.size - 6,
                      },
                    ]}
                  />
                ))}
                {/* One outline as wide as the pieces this friend should get. */}
                {partsEach > 0 && (
                  <View
                    style={[
                      styles.slot,
                      styles.partSlot,
                      short && has.pieces < partsEach && styles.slotHint,
                      {
                        left: part.x + 1,
                        top: part.y + 3,
                        width: partsEach * pieceW - 2,
                        height: geo.size - 6,
                      },
                    ]}
                  />
                )}
                <View
                  testID={`share-count-${g}`}
                  style={[
                    styles.count,
                    { left: f.plate.x, width: f.plate.w, top: f.plate.y + f.plate.h + 4 },
                  ]}
                >
                  {picked && (
                    <AmountText
                      label={formatPieces(has.wholes * groups + has.pieces, groups)}
                      size={22 * scale}
                    />
                  )}
                </View>
              </Fragment>
            );
          })}
          {wholes.map((xy, t) =>
            cut[t] ? null : (
              <Animated.Text
                key={`w${t}`}
                style={[
                  styles.object,
                  objectText(geo.size),
                  { transform: xy.getTranslateTransform() },
                ]}
              >
                {problem.thing.emoji}
              </Animated.Text>
            ),
          )}
          {pieces.map((row, t) =>
            cut[t]
              ? row.map((xy, i) => (
                  <Animated.View
                    key={`p${t}:${i}`}
                    style={[
                      styles.piece,
                      { width: pieceW, height: geo.size, transform: xy.getTranslateTransform() },
                    ]}
                  >
                    <Text
                      style={[
                        styles.pieceText,
                        objectText(geo.size),
                        { left: -(strips[`${t}:${i}`] ?? i) * pieceW },
                      ]}
                    >
                      {problem.thing.emoji}
                    </Text>
                  </Animated.View>
                ))
              : null,
          )}
        </>
      )}
    </View>
  );

  const choices = (
    <View style={[styles.choices, landscape && styles.choicesWrap]}>
      {amounts.map((amount) => {
        const chosen = amount.label === picked?.label;
        const done = tried.includes(amount.label) && !chosen;
        return (
          <Pressable
            key={amount.label}
            accessibilityRole="button"
            accessibilityLabel={amount.label}
            accessibilityState={{ disabled: phase !== 'ask' || done, selected: chosen }}
            disabled={phase !== 'ask' || done}
            onPress={() => void pick(amount)}
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
            <AmountText label={amount.label} size={40 * scale} />
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
  slot: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.line,
  },
  partSlot: { borderRadius: 8 },
  slotHint: { borderColor: colors.gentleInk, backgroundColor: colors.gentle },
  count: { position: 'absolute', alignItems: 'center' },
  object: { position: 'absolute', left: 0, top: 0, textAlign: 'center' },
  piece: { position: 'absolute', left: 0, top: 0, overflow: 'hidden' },
  pieceText: { position: 'absolute', top: 0, textAlign: 'center' },
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
