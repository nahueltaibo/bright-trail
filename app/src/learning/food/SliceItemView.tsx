import { useGameProps } from '../minigames/useGameProps';
import type { ItemViewProps } from '../types';
import { sliceUnit } from './layout';
import { SliceGame } from './SliceGame';

/** Plays an item that has a slices scene as the slices minigame. */
export function SliceItemView(props: ItemViewProps & { shuffleSeed?: string }) {
  const game = useGameProps(props);
  const scene = props.item.slices!;
  const unit = sliceUnit(scene, typeof game.answer === 'number' ? game.answer : 0);
  return <SliceGame {...game} scene={scene} unit={unit} seed={props.item.id} />;
}
