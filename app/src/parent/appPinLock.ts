import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import type { Repository } from '../storage/repository';
import { createPinLock, toHex, type PinLock } from './pin';

export const PIN_KEY = 'parent-pin';

/** Web build. expo-secure-store has no web support, so the hash goes in the settings table. */
export function createAppPinLock(repo: Repository): PinLock {
  return createPinLock({
    store: {
      read: () => repo.settings.get(PIN_KEY),
      write: (value) => repo.settings.set(PIN_KEY, value),
    },
    hash: (text) => digestStringAsync(CryptoDigestAlgorithm.SHA256, text),
    salt: () => toHex(getRandomBytes(16)),
  });
}
