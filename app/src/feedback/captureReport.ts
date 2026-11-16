import { REPORT_CAPTURE_MAX_BYTES } from '@bright-trail/shared';

import { captureItem } from './capture';
import type { CaptureFiles, CaptureOptions, CaptureTarget } from './captureTypes';
import { captureFiles } from './files';

/** PNG keeps flat item art sharp. A busy screen can outgrow the limit, so JPEG steps in. */
const TRIES: CaptureOptions[] = [
  { format: 'png' },
  { format: 'jpg', quality: 0.8 },
  { format: 'jpg', quality: 0.6 },
  { format: 'jpg', quality: 0.4 },
];

export type CaptureDeps = { capture: typeof captureItem; files: CaptureFiles };

/**
 * Captures the item small enough for the Worker: PNG first, then JPEG at falling quality.
 * Returns the file URI, or null when capture is unsupported, fails, or nothing fits. Never throws.
 */
export async function captureForReport(
  target: CaptureTarget,
  deps: CaptureDeps = { capture: captureItem, files: captureFiles },
): Promise<string | null> {
  for (const options of TRIES) {
    const result = await deps.capture(target, options);
    if (!result.ok) return null;
    try {
      const size = deps.files.size(result.uri);
      if (size !== null && size <= REPORT_CAPTURE_MAX_BYTES) return result.uri;
      deps.files.remove(result.uri);
    } catch (e) {
      console.warn('Could not check the capture', e);
      return null;
    }
  }
  return null;
}
