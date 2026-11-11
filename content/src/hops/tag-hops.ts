import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ContentBundleSchema, type Hops, type NumberLineItem } from '@bright-trail/shared';
import { ClaudeCliLlm } from '../graph/cli-llm';
import { cacheKey, withDiskCache, type LlmClient } from '../graph/llm';
import { writeFormatted } from '../graph/write';
import { writeBundle } from '../packs/write-packs';
import { acceptHops, applyHops, hopsCandidates, hopsTagRequest } from './hops';

/**
 * Plans frog paths for number-line items: one cached LLM call per skill. Writes content/hops.json,
 * the reviewed source of truth, and adds the paths to the bundle.
 */
const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundleFile = join(contentDir, 'out', 'bundle.json');
const hopsFile = join(contentDir, 'hops.json');

const { values } = parseArgs({
  options: {
    offline: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '3' },
  },
});

const bundle = ContentBundleSchema.parse(JSON.parse(await readFile(bundleFile, 'utf8')));
const bySkill = new Map<string, NumberLineItem[]>();
for (const item of hopsCandidates(bundle.items)) {
  bySkill.set(item.skillId, [...(bySkill.get(item.skillId) ?? []), item]);
}

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

const paths: Record<string, Hops> = {};
const rejected: string[] = [];
const queue = [...bySkill.entries()];
async function worker() {
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [skillId, items] = next;
    try {
      const result = acceptHops(items, await llm.call(hopsTagRequest(skillId, items)));
      Object.assign(paths, result.paths);
      for (const [id, why] of Object.entries(result.rejected)) rejected.push(`${id}: ${why}`);
      console.log(`${skillId}: ${Object.keys(result.paths).length} of ${items.length} tagged`);
    } catch (error) {
      console.error(`${skillId}: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
}
await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));

const sorted = Object.fromEntries(Object.entries(paths).sort(([a], [b]) => a.localeCompare(b)));
await writeFormatted(hopsFile, JSON.stringify(sorted));
const applied = applyHops(bundle, sorted);
await writeBundle(bundleFile, applied.bundle);

console.log(`${liveCalls} live CLI calls, the rest came from the cache`);
console.log(`${Object.keys(sorted).length} items hop a planned path. Wrote ${hopsFile}`);
if (rejected.length > 0) console.log(`Not tagged:\n  ${rejected.sort().join('\n  ')}`);
