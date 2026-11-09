import { HOPS_DEMO_ITEMS } from '../../learning/hopsDemo';
import { DemoScreen } from '../../learning/minigames/DemoScreen';

/** Dev only: one number-line item per kind of hop path. */
export default function HopsDemoScreen() {
  return <DemoScreen items={HOPS_DEMO_ITEMS} />;
}
