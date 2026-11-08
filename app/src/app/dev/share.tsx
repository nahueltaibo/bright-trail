import { DEMO_ITEMS } from '../../learning/minigames/demo';
import { DemoScreen } from '../../learning/minigames/DemoScreen';

/** Dev only: one sharing item per kind of question. */
export default function ShareDemoScreen() {
  return <DemoScreen items={DEMO_ITEMS} />;
}
