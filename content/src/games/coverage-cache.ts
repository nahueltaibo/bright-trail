import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cacheKey, type LlmRequest } from '../graph/llm';
import type { CacheLookup } from './coverage';

type CacheFile = { tool?: string; output?: Record<string, unknown> };

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown;

/** A tagger's reviewed file, or no tags when it doesn't exist yet. */
export function readReviewed(file: string): Record<string, unknown> {
  return existsSync(file) ? (read(file) as Record<string, unknown>) : {};
}

/** The field names of one entry in the request's answer list, like `itemId,fits,ask`. */
function entryShape(entries: Record<string, unknown>): string {
  return Object.keys(entries).sort().join(',');
}

function requestShape(request: LlmRequest): string | undefined {
  const props = request.tool.inputSchema.properties as
    Record<string, { items?: { properties?: Record<string, unknown> } }> | undefined;
  const list = Object.values(props ?? {})[0]?.items?.properties;
  return list && entryShape(list);
}

/**
 * Reads cached answers from `dir`. An exact miss falls back to an answer from an older prompt
 * with the same tool, the same answer fields, and the same item ids, and `newest` breaks ties.
 */
export function cacheLookup(dir: string, newest: (file: string) => number): CacheLookup {
  let index: Map<string, { file: string; output: unknown }> | undefined;
  const key = (tool: string, shape: string, ids: readonly string[]) =>
    `${tool}|${shape}|${[...ids].sort().join(',')}`;

  // Built on the first miss only, since most runs hit every call exactly.
  function build() {
    const found = new Map<string, { file: string; output: unknown }>();
    for (const file of readdirSync(dir).sort()) {
      const { tool, output } = read(join(dir, file)) as CacheFile;
      if (!tool || !output) continue;
      const list = Object.values(output).find(Array.isArray) as
        Record<string, unknown>[] | undefined;
      const first = list?.[0];
      if (!first || typeof first.itemId !== 'string') continue;
      const ids = list.map((e) => String(e.itemId));
      const k = key(tool, entryShape(first), ids);
      const held = found.get(k);
      if (!held || newest(file) > newest(held.file)) found.set(k, { file, output });
    }
    return found;
  }

  return (request, itemIds) => {
    const file = join(dir, `${cacheKey(request)}.json`);
    if (existsSync(file)) return { output: (read(file) as CacheFile).output, stale: false };
    const shape = requestShape(request);
    if (!shape) return undefined;
    index ??= build();
    const held = index.get(key(request.tool.name, shape, itemIds));
    return held && { output: held.output, stale: true };
  };
}
