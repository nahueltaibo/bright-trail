import { SliceItemView } from './food/SliceItemView';
import { KeypadItemView } from './KeypadItemView';
import { ShareItemView } from './minigames/ShareItemView';
import { NumberLineItemView } from './NumberLineItemView';
import { TapItemView } from './TapItemView';
import type { ItemViewProps } from './types';

/** Picks the screen for the item's type. Key it by item id so each item starts fresh. */
export function ItemView({ item, ...rest }: ItemViewProps & { shuffleSeed?: string }) {
  if (item.scene) return <ShareItemView item={item} {...rest} />;
  if (item.slices) return <SliceItemView item={item} {...rest} />;
  switch (item.type) {
    case 'tap':
      return <TapItemView item={item} {...rest} />;
    case 'keypad':
      return <KeypadItemView item={item} {...rest} />;
    case 'number-line':
      return <NumberLineItemView item={item} {...rest} />;
  }
}
