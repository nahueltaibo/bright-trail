import { GameView } from './games';
import { KeypadItemView } from './KeypadItemView';
import { NumberLineItemView } from './NumberLineItemView';
import { TapItemView } from './TapItemView';
import type { ItemViewProps } from './types';

/**
 * Picks the screen for the item's game, or for its type when it has none. Key it by item id so
 * each item starts fresh.
 */
export function ItemView({ item, ...rest }: ItemViewProps & { shuffleSeed?: string }) {
  if (item.game) return <GameView item={item} game={item.game} {...rest} />;
  switch (item.type) {
    case 'tap':
      return <TapItemView item={item} {...rest} />;
    case 'keypad':
      return <KeypadItemView item={item} {...rest} />;
    case 'number-line':
      return <NumberLineItemView item={item} {...rest} />;
  }
}
