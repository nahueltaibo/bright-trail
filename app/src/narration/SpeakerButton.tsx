import { KidIconButton } from '../design/kid';
import { useNarration, type NarrationOptions } from './NarrationProvider';

type Props = NarrationOptions & {
  /** What to say. Omit to replay the last thing said. */
  text?: string | readonly string[];
  /** Runs after speech starts, e.g. to count replays for the attempt log. */
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** The replay speaker, top-left on kid screens. Always speaks, even in reading mode. */
export function SpeakerButton({
  text,
  onPress,
  accessibilityLabel = 'Hear it again',
  ...options
}: Props) {
  const { speak, replay, isSpeaking } = useNarration(options);

  const press = () => {
    if (text !== undefined) speak(text);
    else replay();
    onPress?.();
  };

  return (
    <KidIconButton icon="speaker" label={accessibilityLabel} busy={isSpeaking} onPress={press} />
  );
}
