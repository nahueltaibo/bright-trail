import type { StonesScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { StonesStage, type StonesStageHandle } from './StonesStage';
import { stonesWords } from './words';

type Props = GameFrameProps & { scene: StonesScene };

/** Finds the missing number in a counting run: the child answers, then the frog hops the stones. */
export function StonesGame(props: Props) {
  const { scene } = props;
  const stage = useRef<StonesStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async () => {
        await stage.current?.play();
        return stonesWords(scene);
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer }) => <StonesStage handle={stage} scene={scene} cheer={cheer} />}
    />
  );
}
