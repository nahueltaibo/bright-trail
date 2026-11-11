import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseContentBundle } from '@bright-trail/shared';
import { packsDir, writeBundle } from './write-packs';

const bundleFile = join(packsDir, '..', 'bundle.json');
const bundle = parseContentBundle(JSON.parse(await readFile(bundleFile, 'utf8')));
await writeBundle(bundleFile, bundle);
console.log(`Wrote packs for bundle ${bundle.version} to ${packsDir}`);
