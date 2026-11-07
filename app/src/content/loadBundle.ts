import { ContentBundleSchema, type ContentBundle } from '@bright-trail/shared';

let cached: Promise<ContentBundle> | undefined;

/**
 * The generated content bundle, validated once. The first screen that needs content pays for
 * building and checking it, so app start doesn't.
 */
export function loadBundle(): Promise<ContentBundle> {
  cached ??= Promise.resolve().then(() =>
    // A require in here, not an import, so Metro runs the JSON module on first use.
    ContentBundleSchema.parse(require('../../../content/out/bundle.json')),
  );
  return cached;
}
