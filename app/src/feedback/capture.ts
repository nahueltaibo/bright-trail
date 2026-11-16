import type { CaptureOptions, CaptureResult, CaptureTarget } from './captureTypes';

export type { CaptureOptions, CaptureResult, CaptureTarget } from './captureTypes';

/** Web build. Web is a dev target, so it sends reports without a capture. */
export async function captureItem(
  _target: CaptureTarget,
  _options?: CaptureOptions,
): Promise<CaptureResult> {
  return { ok: false, reason: 'unsupported' };
}
