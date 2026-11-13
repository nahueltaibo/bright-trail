import type { SortScene } from '@bright-trail/shared';
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { font, radius } from '../../design/tokens';
import { Text } from '../../design/Text';
import type { CardStageHandle } from '../cards/CardGame';
import {
  CardView,
  glide,
  shake,
  StageWorld,
  useCheer,
  useRuns,
  useStageScale,
  within,
  type Box,
  type Tone,
} from '../cards/stage';
import { useDrag, type DragPoint } from '../drag';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { wait } from '../minigames/motion';
import { colors } from '../theme';
import { binOf, layoutOf, START } from './layout';

type Props = {
  scene: SortScene;
  cheer?: boolean;
  handle?: Ref<CardStageHandle>;
  /** Answers with a bin's name. Set while the child can still answer, which lets the card be dragged. */
  onPick?: (word: string) => void;
};

/** Bins with their cards, and the card to sort waiting above them. Driven through `handle`. */
export function SortStage(props: Props) {
  return (
    <StageWorld testID="sort-stage">
      <SortWorld {...props} />
    </StageWorld>
  );
}

function SortWorld({ scene: s, cheer, handle, onPick }: Props) {
  const scale = useStageScale();
  const layout = useMemo(() => layoutOf(s), [s]);
  const [card, setCardState] = useState<Box>(START);
  // The play-out starts from wherever the card was dropped.
  const at = useRef<Box>(START);
  const [tone, setTone] = useState<Tone>('plain');
  const [dx, setDx] = useState(0);
  const [found, setFound] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const runs = useRuns();
  const ids = useRef(0);
  const cheerY = useCheer(cheer);

  const setCard = useRef((b: Box) => {
    at.current = b;
    setCardState(b);
  }).current;

  const k = scale || 1;
  const dropAt = (p: DragPoint) => ({ x: START.x + p.dx / k, y: START.y + p.dy / k });
  const drag = useDrag({
    enabled: onPick !== undefined,
    grab: 'move',
    onMove: (p) => setCard({ ...START, ...dropAt(p) }),
    onDrop: (p) => {
      const to = dropAt(p);
      const bin = layout.bins.findIndex((b) => within(b, to));
      if (bin < 0 || !onPick) return setCard(START);
      setCard({ ...START, ...to });
      onPick(s.bins[bin].text);
    },
    onCancel: () => setCard(START),
  });

  useImperativeHandle(handle, () => ({
    async play(picked) {
      const t = runs.current();
      const live = () => runs.live(t);
      const bin = binOf(s, picked);
      await glide(at.current, layout.landing[bin], 650, setCard, live);
      if (!live()) return;
      if (bin !== s.bin) {
        setTone('miss');
        await shake(setDx, live);
        await wait(250);
        if (!live()) return;
        await glide(layout.landing[bin], layout.landing[s.bin], 550, setCard, live);
        if (!live()) return;
      }
      setTone('good');
      setFound(true);
      const right = layout.bins[s.bin];
      const top = right.y - right.h / 2;
      setBubbles([
        { id: ids.current++, x: right.x, y: top - 16, text: s.bins[s.bin].text, big: true },
      ]);
      await wait(700);
    },
    async reset() {
      runs.next();
      setCard(START);
      setTone('plain');
      setDx(0);
      setFound(false);
      setBubbles([]);
      await wait(50);
    },
  }));

  return (
    <>
      {s.bins.map((bin, i) => {
        const b = layout.bins[i];
        const lit = found && i === s.bin;
        return (
          <View
            key={i}
            testID="sort-bin"
            style={[
              styles.bin,
              { left: b.x - b.w / 2, top: b.y - b.h / 2, width: b.w, height: b.h },
              lit && styles.lit,
            ]}
          >
            <Text numberOfLines={1} style={styles.name}>
              {bin.emoji ? `${bin.emoji} ${bin.text}` : bin.text}
            </Text>
          </View>
        );
      })}
      {s.sorted.map((c, i) => (
        <CardView key={i} box={layout.sorted[i]} text={c.card.text} emoji={c.card.emoji} />
      ))}
      <Animated.View
        style={[StyleSheet.absoluteFill, cheer && { transform: [{ translateY: cheerY }] }]}
        pointerEvents="none"
      >
        <CardView
          testID="sort-card"
          box={card}
          text={s.card.text}
          emoji={s.card.emoji}
          tone={tone}
          dx={dx}
        />
      </Animated.View>
      {onPick && (
        <View
          testID="sort-drag"
          {...drag}
          style={{
            position: 'absolute',
            left: card.x - card.w / 2,
            top: card.y - card.h / 2,
            width: card.w,
            height: card.h,
          }}
        />
      )}
      {bubbles.map((b) => (
        <BubbleView key={b.id} bubble={b} />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  bin: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  lit: { borderColor: colors.goodInk, backgroundColor: colors.good },
  name: { ...font.display(800), fontSize: 16, color: colors.ink, textAlign: 'center' },
});
