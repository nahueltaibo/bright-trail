import type { Skill } from '@bright-trail/shared';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  skills: readonly Skill[];
};

export function HomeScreen({ skills }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to BrightTrail!</Text>
      {skills.map((skill) => (
        <Text key={skill.id} style={styles.skill}>
          {skill.title}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
  },
  skill: {
    fontSize: 18,
  },
});
