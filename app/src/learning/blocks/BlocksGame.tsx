import type { BlocksScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { BlocksStage, type BlocksStageHandle } from './BlocksStage';
import { blocksWords } from './words';

type Props = GameFrameProps & { scene: BlocksScene };

/** Builds a number from flats, rods, and cubes: the child answers, then the blocks trade and count. */
export function BlocksGame(props: Props) {
  const { scene } = props;
  const stage = useRef<BlocksStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async () => {
        await stage.current?.play();
        return blocksWords(scene);
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer }) => <BlocksStage handle={stage} scene={scene} cheer={cheer} />}
    />
  );
}
