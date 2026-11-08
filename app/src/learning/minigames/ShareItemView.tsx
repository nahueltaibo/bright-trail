import { useMemo } from 'react';
import type { ItemViewProps } from '../types';
import { problemFromScene } from './share';
import { ShareGame } from './ShareGame';
import { useGameProps } from './useGameProps';

export { keypadNarration } from './useGameProps';

/** Plays an item that has a scene as the sharing minigame. */
export function ShareItemView(props: ItemViewProps & { shuffleSeed?: string }) {
  const { item } = props;
  const scene = item.scene!;
  const problem = useMemo(() => problemFromScene(scene, item.id), [scene, item.id]);
  return <ShareGame {...useGameProps(props)} problem={problem} />;
}
