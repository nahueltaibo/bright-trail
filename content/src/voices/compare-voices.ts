import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ContentBundleSchema } from '@bright-trail/shared';
import { sampleLines } from './lines';
import { renderVoices } from './render';

/**
 * Renders the sample lines with each TTS provider that has a key in .env, into content/out/voices/,
 * and writes a blind comparison page there.
 */
const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

try {
  process.loadEnvFile(join(contentDir, '..', '.env'));
} catch {
  // No .env skips every provider, and the run says so.
}

const bundle = ContentBundleSchema.parse(
  JSON.parse(await readFile(join(contentDir, 'out', 'bundle.json'), 'utf8')),
);
const result = await renderVoices({
  lines: sampleLines(bundle),
  env: process.env,
  outDir: join(contentDir, 'out', 'voices'),
  log: console.log,
});

console.log(`${result.rendered} clips rendered, ${result.cached} already on disk`);
if (result.failed.length > 0) {
  console.log(`${result.failed.length} failed:\n  ${result.failed.join('\n  ')}`);
  process.exitCode = 1;
}
console.log(`Open ${result.page}`);
