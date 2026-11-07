import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NarrationProvider } from '../narration';
import { StorageProvider } from '../storage/StorageProvider';

export default function RootLayout() {
  return (
    <StorageProvider>
      <NarrationProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NarrationProvider>
      <StatusBar style="auto" />
    </StorageProvider>
  );
}
