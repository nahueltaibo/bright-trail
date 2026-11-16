import { REPORT_CAPTURE_MAX_BYTES } from '@bright-trail/shared';
import { createRef, type ComponentRef } from 'react';
import type { View } from 'react-native';
import { captureForReport, type CaptureDeps } from './captureReport';
import type { CaptureOptions } from './captureTypes';

const target = createRef<ComponentRef<typeof View>>();

/** Captures at the given sizes in turn, naming each file by its format and try. */
function setup(sizes: number[]) {
  const asked: CaptureOptions[] = [];
  const removed: string[] = [];
  const deps: CaptureDeps = {
    capture: async (_, options = { format: 'png' }) => {
      asked.push(options);
      return { ok: true, uri: `file:///cache/${asked.length}.${options.format}` };
    },
    files: {
      size: (uri) => sizes[Number(/(\d+)\./.exec(uri)![1]) - 1],
      remove: (uri) => void removed.push(uri),
      keep: async (uri) => uri,
    },
  };
  return { deps, asked, removed };
}

describe('captureForReport', () => {
  it('keeps a PNG that fits', async () => {
    const { deps, asked, removed } = setup([REPORT_CAPTURE_MAX_BYTES]);
    await expect(captureForReport(target, deps)).resolves.toBe('file:///cache/1.png');
    expect(asked).toEqual([{ format: 'png' }]);
    expect(removed).toEqual([]);
  });

  it('falls back to JPEG at falling quality when the PNG is too big', async () => {
    const { deps, asked, removed } = setup([900_000, 500_000, 300_000]);
    await expect(captureForReport(target, deps)).resolves.toBe('file:///cache/3.jpg');
    expect(asked).toEqual([
      { format: 'png' },
      { format: 'jpg', quality: 0.8 },
      { format: 'jpg', quality: 0.6 },
    ]);
    expect(removed).toEqual(['file:///cache/1.png', 'file:///cache/2.jpg']);
  });

  it('gives up and deletes every try when nothing fits', async () => {
    const { deps, asked, removed } = setup([900_000, 800_000, 700_000, 600_000]);
    await expect(captureForReport(target, deps)).resolves.toBeNull();
    expect(asked).toHaveLength(4);
    expect(removed).toHaveLength(4);
  });

  it('reports no capture when the file system throws', async () => {
    const { deps } = setup([]);
    deps.files.size = () => {
      throw new Error('disk gone');
    };
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(captureForReport(target, deps)).resolves.toBeNull();
  });

  it('reports no capture where capture is unsupported', async () => {
    const { deps } = setup([]);
    deps.capture = async () => ({ ok: false, reason: 'unsupported' });
    await expect(captureForReport(target, deps)).resolves.toBeNull();
  });
});
