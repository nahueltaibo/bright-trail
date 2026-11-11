import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentBundle } from '@bright-trail/shared';
import { writeFormatted } from '../graph/write';
import { splitBundle, type PackFiles } from './split';

const outDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../out');
export const packsDir = join(outDir, 'packs');

/** Reads every file under the packs folder, keyed like `splitBundle`'s output. */
export async function readPackFiles(dir = packsDir): Promise<PackFiles> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => []);
  const files: PackFiles = new Map();
  for (const entry of entries.filter((e) => e.isFile())) {
    const path = join(entry.parentPath, entry.name);
    const key = path.slice(dir.length + 1).replace(/\\/g, '/');
    files.set(key, await readFile(path, 'utf8'));
  }
  return files;
}

/** Writes the bundle and replaces the packs folder with its split. */
export async function writeBundle(bundleFile: string, bundle: ContentBundle): Promise<void> {
  await writeFormatted(bundleFile, JSON.stringify(bundle));
  const { files } = splitBundle(bundle);
  await rm(packsDir, { recursive: true, force: true });
  for (const [name, text] of files) {
    const file = join(packsDir, name);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, text, 'utf8');
  }
}
