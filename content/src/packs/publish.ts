import type { PackFiles } from './split';

export interface Upload {
  key: string;
  body: string;
  cacheControl: string;
}

/** Hashed pack names never change in place. A manifest is rewritten when items change. */
const IMMUTABLE = 'public, max-age=31536000, immutable';
const REVALIDATE = 'public, max-age=60, must-revalidate';

/**
 * Orders the uploads so packs land before the manifests that name them, and a device never reads
 * a manifest pointing at a missing pack. Core ships inside the app, so it isn't uploaded.
 */
export function planUploads(files: PackFiles): Upload[] {
  const packs: Upload[] = [];
  const manifests: Upload[] = [];
  for (const [key, body] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
    if (key === 'core.json') continue;
    if (key.startsWith('manifests/')) manifests.push({ key, body, cacheControl: REVALIDATE });
    else packs.push({ key, body, cacheControl: IMMUTABLE });
  }
  return [...packs, ...manifests];
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const R2_VARS = {
  accountId: 'R2_ACCOUNT_ID',
  accessKeyId: 'R2_ACCESS_KEY_ID',
  secretAccessKey: 'R2_SECRET_ACCESS_KEY',
  bucket: 'R2_BUCKET',
} as const;

/**
 * Reads the R2 settings. Returns null when none are set, so CI can skip publishing until the
 * bucket exists. Throws when only some are set, since that's a typo rather than an opt-out.
 */
export function readR2Config(env: NodeJS.ProcessEnv): R2Config | null {
  const fields = Object.entries(R2_VARS).map(([field, name]) => ({
    field,
    name,
    value: env[name]?.trim(),
  }));
  const missing = fields.filter((f) => !f.value).map((f) => f.name);
  if (missing.length === fields.length) return null;
  if (missing.length > 0) throw new Error(`Missing R2 settings: ${missing.join(', ')}`);
  return Object.fromEntries(fields.map((f) => [f.field, f.value])) as unknown as R2Config;
}

export type PutObject = (upload: Upload) => Promise<void>;

/** Uploads one at a time, in plan order. Stops at the first failure, before any later manifest. */
export async function publish(uploads: readonly Upload[], put: PutObject): Promise<void> {
  for (const upload of uploads) await put(upload);
}
