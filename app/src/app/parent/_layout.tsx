import { Stack } from 'expo-router';
import { useMemo } from 'react';
import { createAppPinLock } from '../../parent/appPinLock';
import { PinGate } from '../../parent/components/PinGate';
import { useStorage } from '../../storage/StorageProvider';

/** Every parent screen sits behind the PIN. */
export default function ParentLayout() {
  const repo = useStorage();
  const lock = useMemo(() => createAppPinLock(repo), [repo]);
  return (
    <PinGate lock={lock}>
      <Stack screenOptions={{ headerShown: false }} />
    </PinGate>
  );
}
