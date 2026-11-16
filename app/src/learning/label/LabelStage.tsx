import { sameTag, type LabelScene } from '@bright-trail/shared';
import { useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, { Circle, Line } from 'react-native-svg';
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
import { wait } from '../minigames/motion';
import { colors } from '../theme';
import { layoutOf, START } from './layout';
import { PICTURE_ART } from './pictures';

type Props = { scene: LabelScene; cheer?: boolean; handle?: Ref<CardStageHandle> };
type Flyer = { text: string; tone: Tone };

/** A picture with tags on its parts and one empty tag, which the picked word slides into. */
export function LabelStage({ scene: s, cheer, handle }: Props) {
  const tags = useMemo(() => layoutOf(s), [s]);
  const asked = tags[s.asked];
  const right = s.tags[s.asked].text;
  const Art = PICTURE_ART[s.picture];
  const [box, setBox] = useState(START);
  const [flyer, setFlyer] = useState<Flyer | null>(null);
  const [dx, setDx] = useState(0);
  const [found, setFound] = useState(false);
  const view = useRef<ViewHandle>(null);
  const runs = useRuns();
  const cheerY = useCheer(cheer);

  useImperativeHandle(handle, () => ({
    hit: hitSpot(view, asked.box),
    async play(picked) {
      const t = runs.current();
      const live = () => runs.live(t);
      setFlyer({ text: picked, tone: 'plain' });
      await glide(START, asked.box, 600, setBox, live);
      if (!live()) return;
      if (!sameTag(picked, right)) {
        setFlyer({ text: picked, tone: 'miss' });
        await shake(setDx, live);
        await wait(200);
        if (!live()) return;
        await glide(asked.box, START, 400, setBox, live);
        if (!live()) return;
        setFlyer({ text: right, tone: 'plain' });
        await glide(START, asked.box, 550, setBox, live);
        if (!live()) return;
      }
      setFlyer({ text: right, tone: 'good' });
      setFound(true);
      await wait(700);
    },
    async reset() {
      runs.next();
      setBox(START);
      setFlyer(null);
      setDx(0);
      setFound(false);
      await wait(50);
    },
  }));

  const edge = (t: (typeof tags)[number]) =>
    t.spot.side === 'left' ? t.box.x + t.box.w / 2 : t.box.x - t.box.w / 2;

  return (
    <StageWorld testID="label-stage" viewRef={view}>
      <Svg width={STAGE_W} height={STAGE_H} style={StyleSheet.absoluteFill}>
        <Art />
        {tags.map((t, i) => {
          const ask = i === s.asked;
          const ink = ask ? (found ? colors.goodInk : colors.accent) : colors.line;
          return [
            <Line
              key={`line-${i}`}
              x1={edge(t)}
              y1={t.box.y}
              x2={t.spot.x}
              y2={t.spot.y}
              stroke={ink}
              strokeWidth={2.5}
              strokeDasharray={ask && !found ? [5, 4] : undefined}
            />,
            <Circle
              key={`spot-${i}`}
              cx={t.spot.x}
              cy={t.spot.y}
              r={ask ? 7 : 5}
              fill="#FFFFFF"
              stroke={ink}
              strokeWidth={3}
            />,
          ];
        })}
      </Svg>
      {tags.map((t, i) =>
        i === s.asked ? (
          <CardView key={i} testID="label-gap" box={t.box} text="?" tone="ask" dashed />
        ) : (
          <CardView key={i} box={t.box} text={s.tags[i].text} />
        ),
      )}
      {flyer && (
        <Animated.View
          style={[StyleSheet.absoluteFill, cheer && { transform: [{ translateY: cheerY }] }]}
          pointerEvents="none"
        >
          <CardView testID="label-tag" box={box} text={flyer.text} tone={flyer.tone} dx={dx} />
        </Animated.View>
      )}
    </StageWorld>
  );
}
