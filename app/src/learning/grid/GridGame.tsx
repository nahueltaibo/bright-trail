import type { GridScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { GridStage, type GridStageHandle } from './GridStage';
import { gridWords } from './words';

type Props = GameFrameProps & {
  scene: GridScene;
  /** Parts shown filled before the answer, for an item whose picture asks about them. */
  filled?: number;
};

/** Reads a part of a whole: the child answers, then a tenths strip or hundred grid fills in. */
export function GridGame(props: Props) {
  const { scene, filled = 0 } = props;
  const stage = useRef<GridStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async () => {
        await stage.current?.play();
        return gridWords(scene);
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer }) => (
        <GridStage handle={stage} scene={scene} cheer={cheer} filled={filled} />
      )}
    />
  );
}
