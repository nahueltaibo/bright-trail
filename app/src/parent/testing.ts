import { createPinLock, type PinLock, type PinStore } from './pin';

type NodeCrypto = {
  createHash(algorithm: 'sha256'): { update(text: string): { digest(encoding: 'hex'): string } };
};

/** SHA-256 from Node, standing in for expo-crypto in tests. */
export const sha256 = async (text: string): Promise<string> =>
  jest.requireActual<NodeCrypto>('node:crypto').createHash('sha256').update(text).digest('hex');

/** A PIN store in memory, with the raw stored value exposed for assertions. */
export function memoryPinStore(): PinStore & { value: string | null } {
  return {
    value: null,
    async read() {
      return this.value;
    },
    async write(value) {
      this.value = value;
    },
  };
}

/** A PIN lock with predictable salts: `salt-1`, `salt-2`, … */
export function testPinLock(store: PinStore = memoryPinStore()): PinLock {
  let n = 0;
  return createPinLock({ store, hash: sha256, salt: () => `salt-${++n}` });
}
