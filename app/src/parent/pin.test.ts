import { isValidPin } from './pin';
import { memoryPinStore, sha256, testPinLock } from './testing';

describe('isValidPin', () => {
  it('accepts exactly 4 digits', () => {
    expect(isValidPin('0123')).toBe(true);
    expect(isValidPin('123')).toBe(false);
    expect(isValidPin('12345')).toBe(false);
    expect(isValidPin('12a4')).toBe(false);
    expect(isValidPin(' 1234')).toBe(false);
  });
});

describe('PIN lock', () => {
  it('has no PIN until one is set, and rejects every PIN until then', async () => {
    const lock = testPinLock();
    expect(await lock.hasPin()).toBe(false);
    expect(await lock.verify('1234')).toBe(false);
  });

  it('accepts the PIN that was set and rejects others', async () => {
    const lock = testPinLock();
    await lock.setPin('4821');
    expect(await lock.hasPin()).toBe(true);
    expect(await lock.verify('4821')).toBe(true);
    expect(await lock.verify('4822')).toBe(false);
    expect(await lock.verify('482')).toBe(false);
  });

  it('stores a salted hash, never the PIN itself', async () => {
    const store = memoryPinStore();
    await testPinLock(store).setPin('4821');
    expect(store.value).toBe(`salt-1:${await sha256('salt-14821')}`);
    expect(store.value).not.toContain('4821');
  });

  it('replaces the old PIN when a new one is set', async () => {
    const lock = testPinLock();
    await lock.setPin('1111');
    await lock.setPin('2222');
    expect(await lock.verify('1111')).toBe(false);
    expect(await lock.verify('2222')).toBe(true);
  });

  it('refuses to set a PIN that is not 4 digits', async () => {
    const store = memoryPinStore();
    await expect(testPinLock(store).setPin('12')).rejects.toThrow(/4 digits/);
    expect(store.value).toBeNull();
  });

  it('rejects everything when the stored value is corrupt', async () => {
    const store = memoryPinStore();
    store.value = 'garbage';
    expect(await testPinLock(store).verify('1234')).toBe(false);
  });
});
