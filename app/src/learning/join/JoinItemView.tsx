import { useGameProps } from '../minigames/useGameProps';
import type { ItemViewProps } from '../types';
import { JoinGame } from './JoinGame';

/** Plays an item that has a join scene as the join-and-leave minigame. */
export function JoinItemView(props: ItemViewProps & { shuffleSeed?: string }) {
  const game = useGameProps(props);
  return <JoinGame {...game} scene={props.item.join!} />;
}
