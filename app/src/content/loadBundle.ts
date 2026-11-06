import { parseContentBundle, type ContentBundle } from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';

let cached: Promise<ContentBundle> | undefined;

/**
 * The content bundle the app plays. Returns the 3-skill sample until I1 swaps in the generated
 * bundle. Async so that swap can read from a file without changing callers.
 */
export function loadBundle(): Promise<ContentBundle> {
  cached ??= Promise.resolve().then(() => parseContentBundle(sample));
  return cached;
}
