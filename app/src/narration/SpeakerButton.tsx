import { Pressable, StyleSheet, Text } from 'react-native';
import { useNarration, type NarrationOptions } from './NarrationProvider';

type Props = NarrationOptions & {
  /** What to say. Omit to replay the last thing said. */
  text?: string | readonly string[];
  /** Runs after speech starts, e.g. to count replays for the attempt log. */
  onPress?: () => void;
  /** Diameter in points. */
  size?: number;
  accessibilityLabel?: string;
};

/** Big round speaker. Always speaks, even in reading mode. */
export function SpeakerButton({
  text,
  onPress,
  size = 88,
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
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ busy: isSpeaking }}
      hitSlop={12}
      onPress={press}
      style={({ pressed }) => [
        styles.button,
        { width: size, height: size, borderRadius: size / 2 },
        isSpeaking && styles.speaking,
        pressed && styles.pressed,
      ]}
    >
      <Text style={{ fontSize: size * 0.5 }}>🔊</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFE7A3' },
  speaking: { backgroundColor: '#FFD25E' },
  pressed: { transform: [{ scale: 0.92 }] },
});
