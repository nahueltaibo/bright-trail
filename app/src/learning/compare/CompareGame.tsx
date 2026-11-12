import type { CompareScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { CompareStage, type CompareStageHandle } from './CompareStage';
import { compareWords } from './words';

type Props = GameFrameProps & { scene: CompareScene };

/** Picks one of a few numbers: the child answers, then towers build or flags drop on a line. */
export function CompareGame(props: Props) {
  const { scene } = props;
  const stage = useRef<CompareStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async () => {
        await stage.current?.play();
        return compareWords(scene);
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer }) => <CompareStage handle={stage} scene={scene} cheer={cheer} />}
    />
  );
}
