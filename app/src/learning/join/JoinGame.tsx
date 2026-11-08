import type { JoinScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { JoinStage, type JoinStageHandle } from './JoinStage';
import { joinWords } from './words';

type Props = GameFrameProps & { scene: JoinScene };

/** A counting, adding, or take-away story on a ten-frame: the child answers, then it plays out. */
export function JoinGame(props: Props) {
  const { scene } = props;
  const stage = useRef<JoinStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async () => {
        await stage.current?.play();
        return joinWords(scene).summary;
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer }) => <JoinStage handle={stage} scene={scene} cheer={cheer} />}
    />
  );
}
