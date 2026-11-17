import { Directory, File, Paths } from 'expo-file-system';

import type { CaptureFiles } from './captureTypes';

export const captureFiles: CaptureFiles = {
  size(uri) {
    const file = new File(uri);
    return file.exists ? file.size : null;
  },
  // Expo's fetch takes a File, which has bytes(), and refuses React Native's { uri } parts.
  uploadPart(uri) {
    const file = new File(uri);
    return file.exists ? file : null;
  },
  remove(uri) {
    const file = new File(uri);
    if (file.exists) file.delete();
  },
  // The OS may clear the cache directory while a report waits to go online.
  async keep(uri, name) {
    const dir = new Directory(Paths.document, 'reports');
    dir.create({ idempotent: true, intermediates: true });
    const kept = new File(dir, name);
    await new File(uri).move(kept);
    return kept.uri;
  },
};
