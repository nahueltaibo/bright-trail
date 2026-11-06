import {
  parseContentBundle,
  type Item,
  type KeypadItem,
  type NumberLineItem,
  type TapItem,
} from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';

export const bundle = parseContentBundle(sample);

export function sampleItem<T extends Item['type']>(id: string, type: T) {
  const item = bundle.items.find((i) => i.id === id);
  if (!item || item.type !== type) throw new Error(`No ${type} item ${id} in the sample`);
  return item as Extract<Item, { type: T }>;
}

export const fishCount: TapItem = sampleItem('k-count-to-20-tap-1', 'tap');
export const applePictures: TapItem = sampleItem('g1-add-within-10-tap-1', 'tap');
export const afterFourteen: KeypadItem = sampleItem('k-count-to-20-keypad-1', 'keypad');
export const findTwelve: NumberLineItem = sampleItem('k-count-to-20-line-1', 'number-line');
