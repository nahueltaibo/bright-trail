import { JOIN_DEMO_ITEMS } from '../../learning/join/demo';
import { DemoScreen } from '../../learning/minigames/DemoScreen';

/** Dev only: one join-and-leave item per kind of question. */
export default function JoinDemoScreen() {
  return <DemoScreen items={JOIN_DEMO_ITEMS} />;
}
