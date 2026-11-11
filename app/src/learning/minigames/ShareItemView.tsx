import type { Scene } from '@bright-trail/shared';
import { useMemo } from 'react';
import type { ItemViewProps } from '../types';
import { problemFromScene } from './share';
import { ShareGame } from './ShareGame';
import { useGameProps } from './useGameProps';

export { keypadNarration } from './useGameProps';

/** Plays an item as the sharing minigame. */
export function ShareItemView({
  scene,
  ...props
}: ItemViewProps & { scene: Scene; shuffleSeed?: string }) {
  const { item } = props;
  const problem = useMemo(() => problemFromScene(scene, item.id), [scene, item.id]);
  return <ShareGame {...useGameProps(props)} problem={problem} />;
}
