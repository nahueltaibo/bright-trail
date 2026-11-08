import { slicesLeft, sliceTotal, type SliceScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { SliceStage, type SliceStageHandle, type StageUnit } from './SliceStage';

const fr = (n: number, d: number) => `${n}/${d}`;

/** What the play-out showed, in words for the feedback card. */
export function sliceSummary(s: SliceScene, unit: StageUnit): string {
  const slice = s.shape === 'circle' ? 'slice' : 'piece';
  const many = (n: number) => `${n} ${slice}${n === 1 ? '' : 's'}`;
  switch (s.ask) {
    case 'picked':
      return unit === 'count'
        ? `${many(s.picked!)} are picked.`
        : `${s.picked} of ${s.parts} equal ${slice}s are picked. That is ${fr(s.picked!, s.parts)}.`;
    case 'left': {
      const start = sliceTotal(s) - (s.eaten ?? 0);
      const left = slicesLeft(s);
      return unit === 'count'
        ? `${start} take away ${s.take} leaves ${many(left)}.`
        : `${fr(start, s.parts)} take away ${fr(s.take!, s.parts)} leaves ${fr(left, s.parts)}.`;
    }
    case 'parts':
      return `It is cut into ${s.parts} equal ${slice}s.`;
    case 'each': {
      const friends = s.friends ?? s.parts;
      const per = s.parts / friends;
      return unit === 'count'
        ? `${s.parts} ${slice}s shared by ${friends} friends is ${many(per)} each.`
        : `Each friend gets ${per} of ${s.parts} equal ${slice}s. That is ${fr(per, s.parts)}.`;
    }
    case 'same': {
      const n = (s.picked! * s.cutInto!) / s.parts;
      return `${fr(s.picked!, s.parts)} and ${fr(n, s.cutInto!)} are the same amount.`;
    }
    case 'bigger': {
      const few = Math.min(s.parts, s.other!);
      const lots = Math.max(s.parts, s.other!);
      return s.want === 'smaller'
        ? `More ${slice}s means smaller ${slice}s. 1/${lots} is smaller than 1/${few}.`
        : `Fewer ${slice}s means bigger ${slice}s. 1/${few} is bigger than 1/${lots}.`;
    }
    case 'add': {
      const sum = s.picked! + s.more!;
      return unit === 'count'
        ? `${s.picked} and ${s.more} more make ${many(sum)}.`
        : `${fr(s.picked!, s.parts)} and ${fr(s.more!, s.parts)} make ${fr(sum, s.parts)}.`;
    }
  }
}

type Props = GameFrameProps & { scene: SliceScene; unit: StageUnit; seed: string };

/** A fraction story on a plate: the child answers, then the slices show why. */
export function SliceGame(props: Props) {
  const { scene, unit, seed } = props;
  const stage = useRef<SliceStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async () => {
        await stage.current?.play();
        return sliceSummary(scene, unit);
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer }) => (
        <SliceStage handle={stage} scene={scene} unit={unit} seed={seed} cheer={cheer} />
      )}
    />
  );
}
