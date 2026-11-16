import type { CaptureFiles } from './captureTypes';

/** Web build. Web makes no captures, so there are never files to look after. */
export const captureFiles: CaptureFiles = {
  size: () => null,
  remove: () => undefined,
  keep: async (uri) => uri,
};
