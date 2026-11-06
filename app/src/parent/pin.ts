export const PIN_LENGTH = 4;

/** Where the salted PIN hash lives. Secure store on phones, SQLite on web. */
export interface PinStore {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
}

export type PinDeps = {
  store: PinStore;
  /** Hex digest of the text, e.g. SHA-256. */
  hash: (text: string) => Promise<string>;
  /** A fresh random salt. */
  salt: () => string;
};

const PIN_PATTERN = new RegExp(`^\\d{${PIN_LENGTH}}$`);

export function isValidPin(pin: string): boolean {
  return PIN_PATTERN.test(pin);
}

/**
 * Keeps kids out of the parent area. Not real security: a 4-digit PIN falls to brute force, so
 * the salt only stops the stored hash from matching a lookup table.
 */
export function createPinLock({ store, hash, salt }: PinDeps) {
  return {
    async hasPin(): Promise<boolean> {
      return (await store.read()) !== null;
    },
    async setPin(pin: string): Promise<void> {
      if (!isValidPin(pin)) throw new Error(`A PIN is ${PIN_LENGTH} digits`);
      const s = salt();
      await store.write(`${s}:${await hash(s + pin)}`);
    },
    /** False for a wrong PIN, and when no PIN is set yet. */
    async verify(pin: string): Promise<boolean> {
      const stored = await store.read();
      if (stored === null || !isValidPin(pin)) return false;
      const split = stored.indexOf(':');
      if (split < 0) return false;
      return (await hash(stored.slice(0, split) + pin)) === stored.slice(split + 1);
    },
  };
}

export type PinLock = ReturnType<typeof createPinLock>;

export const toHex = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
