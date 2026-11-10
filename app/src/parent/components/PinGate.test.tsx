import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { testPinLock } from '../testing';
import { PinGate } from './PinGate';

async function type(pin: string) {
  for (const digit of pin) await fireEvent.press(screen.getByLabelText(digit));
}

const renderGate = (lock = testPinLock()) =>
  render(
    <PinGate lock={lock}>
      <Text>Parent tools</Text>
    </PinGate>,
  );

describe('PinGate', () => {
  it('asks for a new PIN twice on first use, then opens', async () => {
    const lock = testPinLock();
    await renderGate(lock);

    expect(await screen.findByText('Pick a parent PIN')).toBeTruthy();
    await type('1234');
    expect(screen.getByText('Confirm your PIN')).toBeTruthy();
    await type('1234');

    expect(await screen.findByText('Parent tools')).toBeTruthy();
    expect(await lock.verify('1234')).toBe(true);
  });

  it('starts over when the two new PINs differ', async () => {
    const lock = testPinLock();
    await renderGate(lock);
    await screen.findByText('Pick a parent PIN');
    await type('1234');
    await type('4321');

    expect(await screen.findByText("Those PINs didn't match. Start again.")).toBeTruthy();
    expect(screen.getByText('Pick a parent PIN')).toBeTruthy();
    expect(await lock.hasPin()).toBe(false);
  });

  it('stays locked on a wrong PIN and opens on the right one', async () => {
    const lock = testPinLock();
    await lock.setPin('2468');
    await renderGate(lock);

    expect(await screen.findByText('Parent PIN')).toBeTruthy();
    await type('1111');
    expect(await screen.findByText('Wrong PIN. Try again.')).toBeTruthy();
    expect(screen.queryByText('Parent tools')).toBeNull();

    await type('2468');
    expect(await screen.findByText('Parent tools')).toBeTruthy();
  });

  it('deletes a digit', async () => {
    const lock = testPinLock();
    await lock.setPin('2468');
    await renderGate(lock);
    await screen.findByText('Parent PIN');

    await type('9');
    await fireEvent.press(screen.getByLabelText('Delete digit'));
    await type('2468');
    expect(await screen.findByText('Parent tools')).toBeTruthy();
  });
});
