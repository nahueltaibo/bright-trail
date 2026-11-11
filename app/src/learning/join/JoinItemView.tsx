import type { JoinScene } from '@bright-trail/shared';
import { useGameProps } from '../minigames/useGameProps';
import type { ItemViewProps } from '../types';
import { JoinGame } from './JoinGame';

/** Plays an item as the join-and-leave minigame. */
export function JoinItemView({
  scene,
  ...props
}: ItemViewProps & { scene: JoinScene; shuffleSeed?: string }) {
  return <JoinGame {...useGameProps(props)} scene={scene} />;
}
