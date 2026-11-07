import { StyleSheet, Text, View } from 'react-native';

/** Stars earned so far, the app's only reward. No streaks and no timers. */
export function TrailMap({ stars }: { stars: number }) {
  const label = stars === 1 ? '1 star on your trail' : `${stars} stars on your trail`;
  return (
    <View style={styles.trail} accessible accessibilityLabel={label}>
      {stars === 0 ? (
        <Text style={styles.empty}>🌱</Text>
      ) : (
        Array.from({ length: stars }, (_, i) => (
          <Text key={i} style={styles.star}>
            ⭐
          </Text>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  trail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#FFF4D6',
    maxWidth: 520,
  },
  star: { fontSize: 40 },
  empty: { fontSize: 40 },
});
