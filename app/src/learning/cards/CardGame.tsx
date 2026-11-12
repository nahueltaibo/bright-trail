import { useRef, type ReactNode, type Ref } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';

export type CardStageHandle = {
  /** Moves the picked card to its place, and on a miss on to the right one. */
  play(picked: string): Promise<void>;
  /** Back to the question, before any card moved. */
  reset(): Promise<void>;
};

type Props = GameFrameProps & {
  /** The item's why, shown after every answer, since the stage already shows what happened. */
  why: string;
  stage: (handle: Ref<CardStageHandle>, cheer: boolean) => ReactNode;
};

/** Sort it, Put in order, and Label it: the child picks a word, and the stage moves its card. */
export function CardGame({ why, stage, ...props }: Props) {
  const handle = useRef<CardStageHandle>(null);
  return (
    <GameFrame
      {...props}
      playOut={async (_value, _correct, label) => {
        await handle.current?.play(label);
        return why;
      }}
      reset={async () => {
        await handle.current?.reset();
      }}
      stage={({ cheer }) => stage(handle, cheer)}
    />
  );
}
