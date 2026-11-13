import { sameText, type OrderScene } from '@bright-trail/shared';
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import type { CardStageHandle } from '../cards/CardGame';
import {
  CardView,
  glide,
  hitSpot,
  type ViewHandle,
  shake,
  STAGE_H,
  STAGE_W,
  StageWorld,
  useCheer,
  useRuns,
  type Tone,
} from '../cards/stage';
import { BubbleView, type Bubble } from '../minigames/Bubble';
import { wait } from '../minigames/motion';
import { colors } from '../theme';
import { layoutOf } from './layout';

type Props = { scene: OrderScene; cheer?: boolean; handle?: Ref<CardStageHandle> };
type Flyer = { text: string; emoji?: string; tone: Tone };

/** A row of cards with one gap, which the picked card slides up into. Driven through `handle`. */
export function OrderStage({ scene: s, cheer, handle }: Props) {
  const layout = useMemo(() => layoutOf(s), [s]);
  const slot = layout.slots[s.missing];
  const right = s.cards[s.missing];
  const [box, setBox] = useState(layout.start);
  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [dx, setDx] = useState(0);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const view = useRef<ViewHandle>(null);
  const runs = useRuns();
  const ids = useRef(0);
  const cheerY = useCheer(cheer);

  useImperativeHandle(handle, () => ({
    hit: hitSpot(view, slot),
    async play(picked) {
      const t = runs.current();
      const live = () => runs.live(t);
      const correct = sameText(picked, right.text);
      setFlyer({ text: picked, emoji: correct ? right.emoji : undefined, tone: 'plain' });
      await glide(layout.start, slot, 600, setBox, live);
      if (!live()) return;
      if (!correct) {
        setFlyer((f) => f && { ...f, tone: 'miss' });
        await shake(setDx, live);
        await wait(200);
        if (!live()) return;
        await glide(slot, layout.start, 400, setBox, live);
        if (!live()) return;
        setFlyer({ text: right.text, emoji: right.emoji, tone: 'plain' });
        await glide(layout.start, slot, 550, setBox, live);
        if (!live()) return;
      }
      setFlyer((f) => f && { ...f, tone: 'good' });
      const top = slot.y - slot.h / 2;
      setBubbles([{ id: ids.current++, x: slot.x, y: top - 18, text: right.text, big: true }]);
      await wait(700);
    },
    async reset() {
      runs.next();
      setBox(layout.start);
      setFlyer(null);
      setDx(0);
      setBubbles([]);
      await wait(50);
    },
  }));

  return (
    <StageWorld testID="order-stage" viewRef={view}>
      <Svg width={STAGE_W} height={STAGE_H} style={StyleSheet.absoluteFill}>
        {layout.arrows.map(([x0, x1], i) => (
          <Path
            key={i}
            d={`M ${x0} ${layout.rowY} L ${x1} ${layout.rowY} M ${x1 - 6} ${layout.rowY - 6} L ${x1} ${layout.rowY} L ${x1 - 6} ${layout.rowY + 6}`}
            stroke={colors.line}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        ))}
        {layout.loop && (
          <Path
            d={layout.loop}
            stroke={colors.line}
            strokeWidth={3}
            strokeDasharray={[7, 5]}
            strokeLinecap="round"
            fill="none"
          />
        )}
      </Svg>
      {s.cards.map((c, i) =>
        i === s.missing ? (
          <CardView key={i} testID="order-gap" box={slot} text="?" tone="ask" dashed />
        ) : (
          <CardView key={i} box={layout.slots[i]} text={c.text} emoji={c.emoji} />
        ),
      )}
      {flyer && (
        <Animated.View
          style={[StyleSheet.absoluteFill, cheer && { transform: [{ translateY: cheerY }] }]}
          pointerEvents="none"
        >
          <CardView
            testID="order-card"
            box={box}
            text={flyer.text}
            emoji={flyer.emoji}
            tone={flyer.tone}
            dx={dx}
          />
        </Animated.View>
      )}
      {bubbles.map((b) => (
        <BubbleView key={b.id} bubble={b} />
      ))}
    </StageWorld>
  );
}
