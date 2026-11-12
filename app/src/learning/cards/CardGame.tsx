import { useRef, type ReactNode, type Ref } from 'react';
import { GameFrame, type GameFrameProps } from '../minigames/GameFrame';

export type CardStageHandle = {
  /** Moves the picked card to its place, and on a miss on to the right one. */
  play(picked: string): Promise<void>;
  /** Back to the question, before any card moved. */
  reset(): Promise<void>;
  /** Whether a screen point is over the spot a dragged choice should land on. */
  hit?(x: number, y: number): Promise<boolean>;
};

type Props = GameFrameProps & {
  /** The item's why, shown after every answer, since the stage already shows what happened. */
  why: string;
  /** `pick` answers with a choice's word. It's `undefined` once the child has answered. */
  stage: (
    handle: Ref<CardStageHandle>,
    cheer: boolean,
    pick: ((word: string) => void) | undefined,
  ) => ReactNode;
  /** Lets the child drag a choice onto the stage's spot, as well as tap it. */
  dragChoices?: boolean;
};

/** Sort it, Put in order, and Label it: the child picks a word, and the stage moves its card. */
export function CardGame({ why, stage, dragChoices, ...props }: Props) {
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
      onDropChoice={
        dragChoices ? (x, y) => handle.current?.hit?.(x, y) ?? Promise.resolve(false) : undefined
      }
      stage={({ cheer, pick }) => stage(handle, cheer, pick)}
    />
  );
}
