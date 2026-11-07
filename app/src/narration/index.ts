/**
 * Narration: device text-to-speech so a child who can't read can use every screen.
 *
 * Wrap the app in `<NarrationProvider>` (inside `<StorageProvider>`). Then, in a screen or component:
 *
 * - `useAutoNarration(texts)` speaks `texts` in order when the screen gains focus. It stays silent
 *   while the current child has reading mode on. Pass null until the text is loaded.
 * - `useNarration()` returns `{ ready, autoNarrate, isSpeaking, narrate, speak, replay, stop }`.
 *   `narrate` honours reading mode. `speak` and `replay` always speak, for an explicit tap.
 * - `<SpeakerButton text={...} />` is the big replay button. Without `text` it replays the last
 *   thing said. Its `onPress` fires after speech starts, for counting `narrationReplays`.
 *
 * A new `speak` interrupts whatever is playing. Speech a component started stops when its screen
 * loses focus or unmounts. The current child comes from the `childId` route param; pass
 * `{ childId }` to override. With no child (kid home), auto-narration is on.
 *
 * Item screens read a question through `questionSpeech` in `learning/`, which adds the choices
 * only when the item narration doesn't already name them.
 * `speak`, `narrate`, `replay` and `stop` keep their identity across renders.
 */
export {
  NarrationProvider,
  useAutoNarration,
  useNarration,
  type Narration,
  type NarrationOptions,
} from './NarrationProvider';
export { choiceText } from './choiceText';
export { createNarrator, KID_RATE, type Narrator, type SpeechEngine } from './narrator';
export { SpeakerButton } from './SpeakerButton';
