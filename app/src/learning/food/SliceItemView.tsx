import type { SliceScene } from '@bright-trail/shared';
import { useGameProps } from '../minigames/useGameProps';
import type { ItemViewProps } from '../types';
import { sliceUnit } from './layout';
import { SliceGame } from './SliceGame';

/** Plays an item as the slices minigame. */
export function SliceItemView({
  scene,
  ...props
}: ItemViewProps & { scene: SliceScene; shuffleSeed?: string }) {
  const game = useGameProps(props);
  const unit = sliceUnit(scene, typeof game.answer === 'number' ? game.answer : 0);
  return <SliceGame {...game} scene={scene} unit={unit} seed={props.item.id} />;
}
