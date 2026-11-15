import type { WallScene } from '@bright-trail/shared';
import { useRef, useState } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';
import { WallStage, type WallStageHandle } from './WallStage';
import { wallWords } from './words';

type Props = GameFrameProps & {
  scene: WallScene;
  wholes: number;
  /** The item's why, added to the feedback after a miss. */
  why: string;
};

/**
 * Fraction strips under one whole. The child builds the lower strip, or picks an answer and
 * then sees both strips fill. Their edges show which reaches further.
 */
export function WallGame(props: Props) {
  const { scene, wholes, why, retry } = props;
  const stage = useRef<WallStageHandle>(null);
  const [note, setNote] = useState<string | null>(null);
  return (
    <GameFrame
      {...props}
      playOut={async (_value, correct, label) => {
        const shown = await stage.current?.play(label, !correct && !retry);
        if (!shown) return why;
        const words = wallWords(scene, shown, correct, why);
        setNote(words.note);
        return words.feedback;
      }}
      reset={async () => {
        setNote(null);
        await stage.current?.reset();
      }}
      stage={({ cheer, build }) => (
        <WallStage
          handle={stage}
          scene={scene}
          wholes={wholes}
          cheer={cheer}
          build={build}
          note={note}
        />
      )}
    />
  );
}
