import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ContentBundleSchema, type Item, type Scene } from '@bright-trail/shared';
import { ClaudeCliLlm } from '../graph/cli-llm';
import { cacheKey, withDiskCache, type LlmClient } from '../graph/llm';
import { writeFormatted } from '../graph/write';
import { writeBundle } from '../packs/write-packs';
import { acceptScenes, applyScenes, candidateItems, tagRequest } from './scenes';

/**
 * Tags bundle items with sharing scenes: one cached LLM call per skill that has sharing stories.
 * Writes content/scenes.json, the reviewed source of truth, and adds the scenes to the bundle.
 */
const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const bundleFile = join(contentDir, 'out', 'bundle.json');
const scenesFile = join(contentDir, 'scenes.json');

const { values } = parseArgs({
  options: {
    offline: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '3' },
  },
});

const bundle = ContentBundleSchema.parse(JSON.parse(await readFile(bundleFile, 'utf8')));
const bySkill = new Map<string, Item[]>();
for (const item of candidateItems(bundle.items)) {
  bySkill.set(item.skillId, [...(bySkill.get(item.skillId) ?? []), item]);
}
// A skill with one or two hits is a word match in another topic, e.g. "each" in a counting story.
const MIN_PER_SKILL = 3;
for (const [id, items] of bySkill) if (items.length < MIN_PER_SKILL) bySkill.delete(id);

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

const scenes: Record<string, Scene> = {};
const rejected: string[] = [];
const queue = [...bySkill.entries()];
async function worker() {
  for (let next = queue.shift(); next; next = queue.shift()) {
    const [skillId, items] = next;
    try {
      const result = acceptScenes(items, await llm.call(tagRequest(skillId, items)));
      Object.assign(scenes, result.scenes);
      for (const [id, why] of Object.entries(result.rejected)) rejected.push(`${id}: ${why}`);
      console.log(`${skillId}: ${Object.keys(result.scenes).length} of ${items.length} tagged`);
    } catch (error) {
      console.error(`${skillId}: ${(error as Error).message}`);
      process.exitCode = 1;
    }
  }
}
await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));

const sorted = Object.fromEntries(Object.entries(scenes).sort(([a], [b]) => a.localeCompare(b)));
await writeFormatted(scenesFile, JSON.stringify(sorted));
const applied = applyScenes(bundle, sorted);
await writeBundle(bundleFile, applied.bundle);

console.log(`${liveCalls} live CLI calls, the rest came from the cache`);
console.log(`${Object.keys(sorted).length} items play as sharing scenes. Wrote ${scenesFile}`);
if (rejected.length > 0) console.log(`Not tagged:\n  ${rejected.sort().join('\n  ')}`);
