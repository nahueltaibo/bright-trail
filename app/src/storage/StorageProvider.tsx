import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { openAppStorage } from './open';
import type { Repository } from './repository';

const StorageContext = createContext<Repository | null>(null);

/** Opens storage once and renders children only when it's ready. */
export function StorageProvider({ children }: { children: ReactNode }) {
  const [repo, setRepo] = useState<Repository | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    openAppStorage().then(setRepo, setError);
  }, []);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Storage failed to open: {error.message}</Text>
      </View>
    );
  }
  if (!repo) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  return <StorageContext.Provider value={repo}>{children}</StorageContext.Provider>;
}

export function useStorage(): Repository {
  const repo = useContext(StorageContext);
  if (!repo) throw new Error('useStorage must be used inside <StorageProvider>');
  return repo;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  error: { fontSize: 18, color: '#b00020', textAlign: 'center' },
});
