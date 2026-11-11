import { Redirect, useLocalSearchParams } from 'expo-router';
import { GAME_VIEWS, isGameKind } from '../../../learning/games';
import { DemoScreen } from '../../../learning/minigames/DemoScreen';

/** Dev only: one item per kind of question for the game in the URL. */
export default function GameDemoScreen() {
  const { kind } = useLocalSearchParams<{ kind: string }>();
  if (!isGameKind(kind)) return <Redirect href="/" />;
  return <DemoScreen key={kind} items={GAME_VIEWS[kind].demo} />;
}
