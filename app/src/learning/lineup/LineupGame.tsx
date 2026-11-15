import { ORDINALS, type LineupScene } from '@bright-trail/shared';
import { useRef } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { lineupWords, ordinal } from './layout';
import { LineupStage, type LineupStageHandle } from './LineupStage';

type Props = GameFrameProps & { scene: LineupScene };

/**
 * The line walks in while the narrator counts its places. Then the child taps the one in a
 * place, or says which place one is in, and the count plays again up to the answer.
 */
export function LineupGame(props: Props) {
  const { scene } = props;
  const stage = useRef<LineupStageHandle>(null);
  const placeOf = (label: string) => (ORDINALS as readonly string[]).indexOf(label) + 1;
  return (
    <GameFrame
      {...props}
      intro={async () => {
        await stage.current?.lineUp();
      }}
      playOut={async (value, correct) => {
        const tapped = scene.ask === 'find' && !correct ? Number(value) : null;
        await stage.current?.play(tapped);
        return lineupWords(scene);
      }}
      reset={async () => {
        await stage.current?.reset();
      }}
      stage={({ cheer, answer, tried }) => (
        <LineupStage
          handle={stage}
          scene={scene}
          cheer={cheer}
          narrate={props.narrate}
          onTap={answer && ((place) => answer(place, ordinal(place)))}
          tried={tried.map(placeOf).filter((p) => p > 0)}
        />
      )}
    />
  );
}
