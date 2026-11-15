import { wallAnswer, wallFraction, type WallScene } from '@bright-trail/shared';
import {
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ComponentRef,
  type Ref,
} from 'react';
import { Animated, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { color, font, radius } from '../../design/tokens';
import { Text } from '../../design/Text';
import { useDrag } from '../drag';
import type { GameBuild } from '../minigames/GameFrame';
import { wait } from '../minigames/motion';
import { colors } from '../theme';
import { countAt, edgeX, fractionText, isBuild, LABEL_MIN_PIECE } from './layout';
import { piecesName, wallHint } from './words';

export type WallStageHandle = {
  /**
   * Fills the strips for the child's answer, then shows their edges. With `showRight`, a wrong
   * build moves to the right count first. Returns the child's lower strip and the one shown.
   */
  play(picked: string, showRight: boolean): Promise<{ mine: string; lower: string }>;
  /** Back to the question. */
  reset(): Promise<void>;
};

type Props = {
  scene: WallScene;
  wholes: number;
  cheer?: boolean;
  /** Set for a build: the child's count and how to change it. */
  build?: GameBuild;
  /** Said under the wall after the play-out, e.g. which edge reaches further after a miss. */
  note?: string | null;
  handle?: Ref<WallStageHandle>;
};

const PAD = 12;
const GAP = 6;
const WHOLE_H = 44;
const STRIP_H = 52;
/** Room under the wall for the hint or the note. */
const TEXT_H = 56;
const NATURAL_H = 2 * PAD + WHOLE_H + 2 * (GAP + STRIP_H);

/** The fraction wall: one whole on top, the scene's strip, and the strip the child builds or picks. */
export function WallStage({ scene: s, wholes, cheer, build, note, handle }: Props) {
  const building = isBuild(s);
  const than = wallFraction(s.than)!;
  const amount = s.amount === undefined ? null : wallFraction(s.amount);
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const [top, setTop] = useState(building ? than.count : 0);
  // The lower strip's pieces. A match ask learns them from the pick.
  const [lowParts, setLowParts] = useState<number | null>(
    building ? s.parts! : (amount?.parts ?? null),
  );
  const [lowText, setLowText] = useState<string | null>(null);
  // The play-out's own count. A build shows the child's count until then.
  const [shown, setShown] = useState<number | null>(building ? null : 0);
  const [revealed, setRevealed] = useState(false);
  const [hop] = useState(() => new Animated.Value(0));
  const run = useRef(0);
  const wallRef = useRef<ComponentRef<typeof View>>(null);
  const left = useRef<number | null>(null);
  const count = useRef(0);
  useEffect(() => {
    count.current = build?.count ?? 0;
  });

  useEffect(() => {
    if (!cheer) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(hop, { toValue: 1, duration: 220, useNativeDriver: false }),
        Animated.timing(hop, { toValue: 0, duration: 220, useNativeDriver: false }),
      ]),
      { iterations: 3 },
    );
    loop.start();
    return () => loop.stop();
  }, [cheer, hop]);

  useEffect(() => {
    const runs = run;
    return () => {
      runs.current += 1;
    };
  }, []);

  useImperativeHandle(handle, () => {
    const live = (t: number) => run.current === t;
    const fillTo = async (t: number, from: number, to: number, set: (n: number) => void) => {
      const ms = Math.min(160, Math.max(40, 1400 / Math.max(1, Math.abs(to - from))));
      for (let n = from; n !== to;) {
        n += to > from ? 1 : -1;
        if (!live(t)) return;
        set(n);
        await wait(ms);
      }
    };
    return {
      async play(picked, showRight) {
        const t = run.current;
        if (building) {
          const mine = fractionText(count.current, s.parts!);
          const right = wallAnswer(s) as number;
          let lower = mine;
          if (showRight && count.current !== right) {
            setShown(count.current);
            await wait(300);
            await fillTo(t, count.current, right, setShown);
            lower = fractionText(right, s.parts!);
          }
          if (!live(t)) return { mine, lower };
          setLowText(lower);
          setRevealed(true);
          await wait(500);
          return { mine, lower };
        }
        const low = s.ask === 'match' ? wallFraction(picked)! : amount!;
        const text = s.ask === 'match' ? picked : s.amount!;
        setLowParts(low.parts);
        setLowText(text);
        await fillTo(t, 0, than.count, setTop);
        await wait(200);
        await fillTo(t, 0, low.count, (n) => setShown(n));
        if (!live(t)) return { mine: text, lower: text };
        setRevealed(true);
        await wait(500);
        return { mine: text, lower: text };
      },
      async reset() {
        run.current += 1;
        setRevealed(false);
        setLowText(null);
        if (building) setShown(null);
        else {
          setTop(0);
          setShown(0);
          if (s.ask === 'match') setLowParts(null);
        }
        await wait(50);
      },
    };
  });

  const width = box ? box.w - 2 * PAD : 0;
  const k = box ? Math.max(0.55, Math.min(1, (box.h - TEXT_H) / NATURAL_H)) : 1;
  const stripH = STRIP_H * k;
  const lowCount = shown ?? build?.count ?? 0;
  const lowPieces = lowParts === null ? 0 : lowParts * wholes;
  const active = building && build !== undefined && !revealed;

  const at = (pageX: number) => (left.current === null ? null : pageX - left.current - PAD);
  const drag = useDrag({
    enabled: active,
    grab: 'press',
    onGrab: (e) => {
      const { pageX } = e.nativeEvent;
      wallRef.current?.measureInWindow((wallX) => {
        left.current = wallX;
        const x = at(pageX);
        if (x !== null) build?.set(countAt(x, width, lowPieces, 'tap', count.current));
      });
    },
    onMove: (p) => {
      const x = at(p.pageX);
      // A small wobble is still a tap, so it keeps the tapped piece.
      if (x === null || Math.abs(p.dx) < 6) return;
      build?.set(countAt(x, width, lowPieces, 'drag', count.current));
    },
  });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setBox({ w, h });
  };

  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const thanX = edgeX(than, wholes, width);
  const lowX = lowParts === null ? 0 : edgeX({ count: lowCount, parts: lowParts }, wholes, width);
  const edgesTop = PAD + (WHOLE_H + GAP) * k - GAP;
  const edgesH = 2 * stripH + GAP * k + 2 * GAP;
  const same = revealed && Math.abs(thanX - lowX) < 0.5;
  const lowLabel = lowText ?? (lowParts === null ? '' : fractionText(lowCount, lowParts));

  return (
    <View style={styles.stage} onLayout={onLayout} testID="wall-stage">
      {box && width > 0 && (
        <Animated.View style={{ transform: [{ translateY: hopY }] }}>
          <View
            ref={wallRef}
            {...drag}
            style={[styles.wall, { padding: PAD, gap: GAP * k }]}
            accessible={active}
            accessibilityRole={active ? 'adjustable' : undefined}
            accessibilityLabel={active ? `Strip of ${piecesName(s.parts!)}` : undefined}
            accessibilityValue={
              active ? { min: 0, max: lowPieces, now: lowCount, text: lowLabel } : undefined
            }
            accessibilityActions={
              active ? [{ name: 'increment' }, { name: 'decrement' }] : undefined
            }
            onAccessibilityAction={(e) =>
              build?.set(count.current + (e.nativeEvent.actionName === 'increment' ? 1 : -1))
            }
          >
            <View
              style={[styles.row, { height: WHOLE_H * k }]}
              accessibilityLabel={wholes === 1 ? 'One whole' : `${wholes} wholes`}
            >
              {Array.from({ length: wholes }, (_, i) => (
                <View key={i} style={[styles.piece, styles.whole]}>
                  <Text style={[styles.wholeText, { fontSize: 20 * k }]}>1</Text>
                </View>
              ))}
            </View>
            <Strip
              parts={than.parts}
              wholes={wholes}
              count={top}
              fill={color.stripA}
              ink={color.onStripA}
              tag={building || revealed ? s.than : null}
              width={width}
              height={stripH}
              testID="wall-top"
            />
            <Strip
              parts={lowParts}
              wholes={wholes}
              count={lowCount}
              fill={color.stripB}
              ink={color.onStripB}
              tag={(building && lowCount > 0) || revealed ? lowLabel : null}
              width={width}
              height={stripH}
              testID="wall-lower"
            />
            <Svg
              pointerEvents="none"
              width={width}
              height={edgesH}
              style={[styles.edges, { left: PAD, top: edgesTop }]}
            >
              {active && (
                <>
                  <Rect
                    x={1.5}
                    y={GAP + stripH + GAP * k + 1.5}
                    width={width - 3}
                    height={stripH - 3}
                    rx={radius.sm}
                    fill="none"
                    stroke={color.stripB}
                    strokeWidth={3}
                    strokeDasharray="8 6"
                  />
                  <Line
                    x1={thanX}
                    x2={thanX}
                    y1={0}
                    y2={edgesH}
                    stroke={colors.ink}
                    strokeWidth={3}
                    strokeDasharray="7 5"
                    testID="wall-guide"
                  />
                </>
              )}
              {revealed && !same && (
                <>
                  <Rect
                    x={Math.min(thanX, lowX)}
                    y={0}
                    width={Math.abs(thanX - lowX)}
                    height={edgesH}
                    fill={color.star}
                    opacity={0.45}
                  />
                  <Line
                    x1={thanX}
                    x2={thanX}
                    y1={0}
                    y2={edgesH}
                    stroke={color.stripA}
                    strokeWidth={3}
                  />
                  <Line
                    x1={lowX}
                    x2={lowX}
                    y1={0}
                    y2={edgesH}
                    stroke={color.stripB}
                    strokeWidth={3}
                  />
                </>
              )}
              {same && (
                <Line
                  x1={thanX}
                  x2={thanX}
                  y1={0}
                  y2={edgesH}
                  stroke={color.hitInk}
                  strokeWidth={4}
                  testID="wall-same"
                />
              )}
            </Svg>
          </View>
          <Text
            style={[styles.note, revealed && styles.noteStrong, { minHeight: TEXT_H - 10 }]}
            testID="wall-note"
          >
            {revealed ? (note ?? '') : building ? wallHint(s) : ''}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

type StripProps = {
  /** Pieces in each whole. Null draws an empty strip, for a pick still to come. */
  parts: number | null;
  wholes: number;
  count: number;
  fill: string;
  ink: string;
  /** The amount written at the strip's edge. */
  tag: string | null;
  width: number;
  height: number;
  testID: string;
};

function Strip({ parts, wholes, count, fill, ink, tag, width, height, testID }: StripProps) {
  const pieces = parts === null ? 0 : parts * wholes;
  const labelled = pieces > 0 && width / pieces >= LABEL_MIN_PIECE;
  const x = pieces > 0 ? (count / pieces) * width : 0;
  const tagW = tag ? 16 + tag.length * 10 : 0;
  const tagLeft = x < tagW + 8;
  return (
    <View
      style={[styles.row, { height }]}
      testID={testID}
      accessibilityLabel={tag && parts ? `${tag}: ${count} pieces of 1/${parts}` : undefined}
    >
      {pieces === 0 && <View style={styles.piece} />}
      {Array.from({ length: pieces }, (_, i) => (
        <View
          key={i}
          style={[
            styles.piece,
            i < count && { backgroundColor: fill, borderColor: colors.background },
          ]}
        >
          {labelled && !(tag && i < count) && (
            <Text style={[styles.pieceText, i < count && { color: ink }]}>
              {parts === 1 ? '1' : `1/${parts}`}
            </Text>
          )}
        </View>
      ))}
      {tag && count > 0 && (
        <View
          pointerEvents="none"
          style={[
            styles.tag,
            { backgroundColor: ink },
            tagLeft ? { left: x + 4 } : { right: width - x + 4 },
          ]}
        >
          <Text style={[styles.tagText, { color: fill }]}>{tag}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, margin: 8, justifyContent: 'center' },
  wall: { borderRadius: radius.lg, backgroundColor: colors.surface },
  row: {
    flexDirection: 'row',
    borderRadius: radius.sm,
    overflow: 'hidden',
    alignItems: 'stretch',
  },
  piece: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.line,
  },
  whole: { backgroundColor: color.trail, borderColor: color.trailDeep },
  wholeText: { ...font.display(800), color: color.onTrail },
  pieceText: { ...font.body(700), fontSize: 13, color: colors.softInk },
  tag: {
    position: 'absolute',
    top: '50%',
    marginTop: -13,
    height: 26,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    justifyContent: 'center',
  },
  tagText: { ...font.display(800), fontSize: 18, lineHeight: 24 },
  edges: { position: 'absolute' },
  note: {
    ...font.body(400),
    marginTop: 10,
    fontSize: 17,
    lineHeight: 23,
    color: colors.softInk,
    textAlign: 'center',
  },
  noteStrong: { ...font.body(700), color: colors.ink },
});
