import {
  AtkinsonHyperlegible_400Regular,
  AtkinsonHyperlegible_700Bold,
} from '@expo-google-fonts/atkinson-hyperlegible';
import {
  Baloo2_400Regular,
  Baloo2_500Medium,
  Baloo2_600SemiBold,
  Baloo2_700Bold,
  Baloo2_800ExtraBold,
} from '@expo-google-fonts/baloo-2';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NarrationProvider } from '../narration';
import { StorageProvider } from '../storage/StorageProvider';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    Baloo2_400Regular,
    Baloo2_500Medium,
    Baloo2_600SemiBold,
    Baloo2_700Bold,
    Baloo2_800ExtraBold,
  });
  // A font that fails to load falls back to the system face rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <StorageProvider>
      <NarrationProvider>
        <Stack screenOptions={{ headerShown: false }} />
      </NarrationProvider>
      <StatusBar style="auto" />
    </StorageProvider>
  );
}
