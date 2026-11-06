import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StorageProvider } from '../storage/StorageProvider';

export default function RootLayout() {
  return (
    <StorageProvider>
      <Stack screenOptions={{ headerShown: false }} />
      <StatusBar style="auto" />
    </StorageProvider>
  );
}
