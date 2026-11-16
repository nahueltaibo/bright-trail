import type { ComponentRef, RefObject } from 'react';
import type { View } from 'react-native';

/** The view to capture: the item area only, so the status bar and system UI stay out. */
export type CaptureTarget = RefObject<ComponentRef<typeof View> | null>;

export type CaptureResult =
  | { ok: true; /** A PNG file URI. */ uri: string }
  | { ok: false; reason: 'unsupported' }
  | { ok: false; reason: 'failed'; error: string };
