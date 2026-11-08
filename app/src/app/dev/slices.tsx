import { SLICE_DEMO_ITEMS } from '../../learning/food/demo';
import { DemoScreen } from '../../learning/minigames/DemoScreen';

/** Dev only: one slices item per kind of question. */
export default function SlicesDemoScreen() {
  return <DemoScreen items={SLICE_DEMO_ITEMS} />;
}
