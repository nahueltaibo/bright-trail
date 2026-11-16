import { captureRef } from 'react-native-view-shot';

import type { CaptureResult, CaptureTarget } from './captureTypes';

export type { CaptureResult, CaptureTarget } from './captureTypes';

/** Captures the view to a PNG in the cache directory. Never throws: a report can go without one. */
export async function captureItem(target: CaptureTarget): Promise<CaptureResult> {
  if (!target.current) return { ok: false, reason: 'failed', error: 'The view is not mounted' };
  try {
    const uri = await captureRef(target, { format: 'png', result: 'tmpfile' });
    return { ok: true, uri };
  } catch (e) {
    return { ok: false, reason: 'failed', error: e instanceof Error ? e.message : String(e) };
  }
}
