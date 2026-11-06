import { greet } from '@bright-trail/shared';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  learnerName: string;
};

export function HomeScreen({ learnerName }: Props) {
  const greeting = greet(learnerName);
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{greeting.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
});
