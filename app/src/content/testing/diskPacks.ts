import {
  assembleBundle,
  ContentManifestSchema,
  ContentPackSchema,
  manifestPath,
  type ContentBundle,
  type ContentManifest,
} from '@bright-trail/shared';
import { loadCore } from '../core';
import type { PackSource } from '../packs';

// Minimal typing for the Node modules, so the app needn't pull in @types/node.
type Fs = { readFileSync(path: string, encoding: 'utf8'): string };
type Crypto = {
  createHash(algorithm: string): { update(text: string): { digest(e: 'hex'): string } };
};

declare const __dirname: string;
const PACKS_DIR = `${__dirname}/../../../../content/out/packs`;
export const DISK_URL = 'https://packs.test';

/** Test-only: reads a file under `content/out/packs/`. */
export function readPackFile(path: string): string {
  return jest.requireActual<Fs>('node:fs').readFileSync(`${PACKS_DIR}/${path}`, 'utf8');
}

export function diskManifest(): ContentManifest {
  return ContentManifestSchema.parse(JSON.parse(readPackFile(manifestPath(loadCore().hash))));
}

/** Test-only: serves `content/out/packs/` under `DISK_URL`, logging each path asked for. */
export function diskSource(requests: string[] = []): PackSource {
  return {
    baseUrl: DISK_URL,
    async fetchText(url) {
      const path = url.slice(DISK_URL.length + 1);
      requests.push(path);
      return readPackFile(path);
    },
    async sha256(text) {
      return jest
        .requireActual<Crypto>('node:crypto')
        .createHash('sha256')
        .update(text)
        .digest('hex');
    },
  };
}

let cached: ContentBundle | undefined;

/** Test-only: the shipped core with every generated pack, as the app sees it with all downloaded. */
export function diskBundle(): ContentBundle {
  const manifest = diskManifest();
  cached ??= assembleBundle(
    loadCore(),
    manifest,
    manifest.packs.map((p) => ContentPackSchema.parse(JSON.parse(readPackFile(p.file)))),
  );
  return cached;
}
