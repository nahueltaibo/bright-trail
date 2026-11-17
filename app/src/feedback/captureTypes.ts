import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

/** The view to capture: the item area only, so the status bar and system UI stay out. */
export type CaptureTarget = RefObject<ComponentRef<typeof View> | null>;

/** PNG by default. `quality` runs from 0 to 1 and applies to JPEG only. */
export type CaptureOptions = { format: 'png' } | { format: 'jpg'; quality: number };

export type CaptureResult =
  | { ok: true; /** A PNG or JPEG file URI, by the format asked for. */ uri: string }
  | { ok: false; reason: 'unsupported' }
  | { ok: false; reason: 'failed'; error: string };

/** The file calls the report flow makes, so tests can run it without a device. */
export type CaptureFiles = {
  /** Bytes in the file, or null when it's gone. */
  size(uri: string): number | null;
  /** The file as a multipart upload part, or null when it's gone. */
  uploadPart(uri: string): unknown;
  /** Deletes the file if it's there. */
  remove(uri: string): void;
  /** Moves a capture out of the cache directory, named `name`, and returns its new URI. */
  keep(uri: string, name: string): Promise<string>;
};
