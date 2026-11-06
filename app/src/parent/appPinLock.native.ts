import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from 'expo-crypto';
import { getItemAsync, setItemAsync } from 'expo-secure-store';
import type { Repository } from '../storage/repository';
import { createPinLock, toHex, type PinLock } from './pin';

export const PIN_KEY = 'parent-pin';

/** Phones and tablets keep the PIN hash in the OS keychain or keystore. */
export function createAppPinLock(_repo: Repository): PinLock {
  return createPinLock({
    store: {
      read: () => getItemAsync(PIN_KEY),
      write: (value) => setItemAsync(PIN_KEY, value),
    },
    hash: (text) => digestStringAsync(CryptoDigestAlgorithm.SHA256, text),
    salt: () => toHex(getRandomBytes(16)),
  });
}
