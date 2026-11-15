import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ContentBundleSchema } from '@bright-trail/shared';
import { ClaudeCliLlm } from '../graph/cli-llm';
import { cacheKey, withDiskCache, type LlmClient } from '../graph/llm';
import { writeFormatted } from '../graph/write';
import { writeBundle } from '../packs/write-packs';
import { isTaggerKind, TAGGERS } from './registry';
import { tagItems, type Tagger } from './tagger';

/**
 * Tags bundle items for one minigame, `--kind share|slices|join|compare|arrays|grid|blocks|stones|lineup|hops`, with one cached LLM
 * call per skill. Writes the game's reviewed file under content/ and adds the tags to the bundle.
 */
const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundleFile = join(contentDir, 'out', 'bundle.json');

const { values } = parseArgs({
  options: {
    kind: { type: 'string' },
    offline: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '3' },
  },
});
if (!values.kind || !isTaggerKind(values.kind)) {
  console.error(`Pass --kind with one of: ${Object.keys(TAGGERS).join(', ')}`);
  process.exit(1);
}
const tagger = TAGGERS[values.kind] as Tagger;
const tagsFile = join(contentDir, tagger.file);

const live = new ClaudeCliLlm();
let liveCalls = 0;
const llm: LlmClient = withDiskCache(
  {
    call: (request) => {
      if (values.offline) return Promise.reject(new Error(`Not cached: ${cacheKey(request)}`));
      liveCalls++;
      return live.call(request);
    },
  },
  join(contentDir, 'cache', 'llm'),
);

const bundle = ContentBundleSchema.parse(JSON.parse(await readFile(bundleFile, 'utf8')));
const run = await tagItems(tagger, bundle.items, llm, Number(values.concurrency), console.log);
if (run.failed.length > 0) process.exitCode = 1;

await writeFormatted(tagsFile, JSON.stringify(run.tagged));
const applied = tagger.apply(bundle, run.tagged);
await writeBundle(bundleFile, applied.bundle);

console.log(`${liveCalls} live CLI calls, the rest came from the cache`);
console.log(`${Object.keys(run.tagged).length} items ${tagger.outcome}. Wrote ${tagsFile}`);
if (run.rejected.length > 0) console.log(`Not tagged:\n  ${run.rejected.join('\n  ')}`);
