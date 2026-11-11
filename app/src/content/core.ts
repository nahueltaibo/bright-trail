import { ContentCoreSchema, type ContentCore } from '@bright-trail/shared';

let cached: ContentCore | undefined;

/** The skill graph shipped in the app. Packs download for this core's hash. */
export function loadCore(): ContentCore {
  // A require in here, not an import, so Metro runs the JSON module on first use.
  cached ??= ContentCoreSchema.parse(require('../../../content/out/packs/core.json'));
  return cached;
}
