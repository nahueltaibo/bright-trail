import { SliceItemView } from './food/SliceItemView';
import { JoinItemView } from './join/JoinItemView';
import { KeypadItemView } from './KeypadItemView';
import { ShareItemView } from './minigames/ShareItemView';
import { NumberLineItemView } from './NumberLineItemView';
import { TapItemView } from './TapItemView';
import type { ItemViewProps } from './types';

/**
 * Picks the screen for the item's game, or for its type when it has none. Key it by item id so
 * each item starts fresh.
 */
export function ItemView({ item, ...rest }: ItemViewProps & { shuffleSeed?: string }) {
  const { game } = item;
  switch (game?.kind) {
    case 'share':
      return <ShareItemView item={item} scene={game} {...rest} />;
    case 'slices':
      return <SliceItemView item={item} scene={game} {...rest} />;
    case 'join':
      return <JoinItemView item={item} scene={game} {...rest} />;
  }
  switch (item.type) {
    case 'tap':
      return <TapItemView item={item} {...rest} />;
    case 'keypad':
      return <KeypadItemView item={item} {...rest} />;
    case 'number-line':
      return <NumberLineItemView item={item} {...rest} />;
  }
}
