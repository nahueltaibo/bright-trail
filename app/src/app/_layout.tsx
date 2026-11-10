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
import {
  Lexend_400Regular,
  Lexend_500Medium,
  Lexend_600SemiBold,
  Lexend_700Bold,
} from '@expo-google-fonts/lexend';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ChildFontProvider } from '../components/ChildFontProvider';
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
    Lexend_400Regular,
    Lexend_500Medium,
    Lexend_600SemiBold,
    Lexend_700Bold,
  });
  // A font that fails to load falls back to the system face rather than blocking the app.
  if (!fontsLoaded && !fontError) return null;

  return (
    <StorageProvider>
      <ChildFontProvider>
        <NarrationProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </NarrationProvider>
      </ChildFontProvider>
      <StatusBar style="auto" />
    </StorageProvider>
  );
}
