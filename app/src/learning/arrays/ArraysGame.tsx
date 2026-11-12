import type { ArrayScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { ArraysStage, type ArraysStageHandle } from './ArraysStage';
import { arrayWords } from './words';

type Props = GameFrameProps & { scene: ArrayScene };

/** Things in rows and columns: the child answers, then the array fills, deals, turns, or splits. */
export function ArraysGame(props: Props) {
  const { scene } = props;
  const stage = useRef<ArraysStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async () => {
        await stage.current?.play();
        return arrayWords(scene);
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer }) => <ArraysStage handle={stage} scene={scene} cheer={cheer} />}
    />
  );
}
