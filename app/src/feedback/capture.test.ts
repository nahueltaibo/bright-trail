import { createRef, type ComponentRef } from 'react';
import type { View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { captureItem } from './capture';

jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn() }));
const capture = jest.mocked(captureRef);

function mounted() {
  const ref = createRef<ComponentRef<typeof View>>();
  (ref as { current: unknown }).current = {};
  return ref;
}

describe('captureItem', () => {
  beforeEach(() => capture.mockReset());

  it('captures the given view to a PNG file', async () => {
    capture.mockResolvedValue('file:///cache/shot.png');
    const ref = mounted();
    await expect(captureItem(ref)).resolves.toEqual({ ok: true, uri: 'file:///cache/shot.png' });
    expect(capture).toHaveBeenCalledWith(ref, { format: 'png', result: 'tmpfile' });
  });

  it('fails without capturing when the view is not mounted', async () => {
    await expect(captureItem(createRef<ComponentRef<typeof View>>())).resolves.toMatchObject({
      ok: false,
      reason: 'failed',
    });
    expect(capture).not.toHaveBeenCalled();
  });

  it('turns a native error into a failed result', async () => {
    capture.mockRejectedValue(new Error('boom'));
    await expect(captureItem(mounted())).resolves.toEqual({
      ok: false,
      reason: 'failed',
      error: 'boom',
    });
  });
});
