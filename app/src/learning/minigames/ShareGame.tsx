import { formatAmount, toAmount, type Amount } from '@bright-trail/shared';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLayout } from '../theme';
import { GameFrame, type GameFrameProps, type GameValue } from './GameFrame';
import { slotsFor, type ShareProblem, type Side } from './share';
import { Stage, type StageHandle, type Tone } from './Stage';

type StageLook = {
  outline?: Pick<Amount, 'whole' | 'parts' | 'den'> | null;
  hint?: { source?: boolean; emptySpots?: boolean; receivers?: (Tone | null)[] };
  counts?: boolean;
};

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

type Props = GameFrameProps & { problem: ShareProblem };

/**
 * A sharing story played out. The child answers, then the things move so the child sees why the
 * answer is right or not: leftovers, empty spots, groups filling up, or counts.
 */
export function ShareGame(props: Props) {
  const { problem: p, input, answer } = props;
  const { scale } = useLayout();
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
  const [look, setLook] = useState<StageLook>({ counts: p.ask === 'total' });
  const [otherLook, setOtherLook] = useState<StageLook>({});

  /** Plays the story out for the child's answer and says what happened. */
  const playOut = async (value: GameValue): Promise<string> => {
    const s = stage.current!;
    const word = (n: number) => receiverWord(p, n);
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
          return `Fair share! Each ${word(1)} gets ${howMuch(p, amount.value)}, and nothing is left over.`;
        }
        if (plan.result === 'leftover') {
          return `Almost! ${howMuch(p, left)} still left. Each ${word(1)} can get more.`;
        }
        return `We ran out! There is not enough to give each ${word(1)} ${amount.label}.`;
      }
      case 'left': {
        const each = toAmount(Math.floor(p.total / groups))!;
        setLook({ outline: each, counts: true });
        await s.deal(each);
        const left = await s.countLeft();
        setLook({ outline: each, counts: true, hint: { source: left > 0 } });
        return `Each ${word(1)} gets ${each.value}, and ${left} ${left === 1 ? 'is' : 'are'} left over.`;
      }
      case 'groups': {
        setLook({ outline: toAmount(p.each!), counts: true });
        await s.fill(p.each!);
        return `${p.total} ${p.thing.many}, ${p.each} in each. That fills ${groups} ${word(groups)}.`;
      }
      case 'total': {
        await s.collect();
        return `${groups} ${word(groups)} with ${p.each} each make ${p.total} ${p.thing.many} in all.`;
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
        return equal
          ? `Everyone has ${split[0]}. That is fair.`
          : `${split.map((n, r) => `${nameOf(p.side, r)} has ${n}`).join(', ')}. That is not fair.`;
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
        return `With ${groups} ${word(groups)}, each gets ${howMuch(p, mine)}. With ${n}, each gets ${howMuch(p, theirs)}.`;
      }
    }
  };

  const reset = async () => {
    await Promise.all([stage.current?.reset(), otherStage.current?.reset()]);
    setLook({ counts: p.ask === 'total' });
    setOtherLook({});
  };

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
  };
  return (
    <GameFrame
      {...props}
      playOut={playOut}
      reset={reset}
      stage={({ cheer }) => (
        <View style={styles.stages}>
          <Stage handle={stage} side={p.side} {...shared} cheer={cheer} {...look} />
          {p.other && (
            <Stage handle={otherStage} side={p.other} {...shared} cheer={cheer} {...otherLook} />
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({ stages: { flex: 1 } });
