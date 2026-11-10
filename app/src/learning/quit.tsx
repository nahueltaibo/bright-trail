import { createContext, useContext } from 'react';
import { KidIconButton } from '../design/kid';

/** Set by the session so every item and story screen can offer a break. */
export const QuitContext = createContext<(() => void) | null>(null);

/** "Take a break", in the middle of the top bar. Renders nothing outside a session. */
export function QuitButton() {
  const quit = useContext(QuitContext);
  if (!quit) return null;
  return <KidIconButton icon="pause" label="Stop for now" onPress={quit} />;
}
