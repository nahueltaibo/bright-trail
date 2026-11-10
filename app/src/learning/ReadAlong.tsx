import { ScrollView, StyleSheet, Text } from 'react-native';
import { font } from '../design/tokens';
import { colors, useLayout } from './theme';

/** What the narrator says, written out so kids can read along or re-read it. Scrolls if long. */
export function ReadAlong({ text, lines = 3.5 }: { text: string; lines?: number }) {
  const { scale } = useLayout();
  const lineHeight = 28 * scale;
  return (
    <ScrollView
      testID="read-along"
      style={[styles.box, { maxHeight: lines * lineHeight + 16 }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.text, { fontSize: 20 * scale, lineHeight }]}>{text}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  box: { flexGrow: 0, flexShrink: 0, alignSelf: 'stretch', marginHorizontal: 12 },
  content: { paddingHorizontal: 12, paddingVertical: 8 },
  text: { ...font.body(), color: colors.softInk, textAlign: 'center' },
});
