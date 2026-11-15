import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cacheKey, type LlmRequest } from '../graph/llm';
import { cacheLookup, readReviewed } from './coverage-cache';

const request = (tool: string, fields: string[], prompt: string): LlmRequest => ({
  model: 'm',
  system: 's',
  prompt,
  tool: {
    name: tool,
    description: 'd',
    inputSchema: {
      properties: {
        scenes: { items: { properties: Object.fromEntries(fields.map((f) => [f, {}])) } },
      },
    },
  },
  maxTokens: 1,
});

const entries = (fields: string[], ids: string[], tag: string) => ({
  scenes: ids.map((itemId) => ({ ...Object.fromEntries(fields.map((f) => [f, tag])), itemId })),
});

describe('cacheLookup', () => {
  const dir = mkdtempSync(join(tmpdir(), 'coverage-cache-'));
  const save = (file: string, tool: string, output: unknown) =>
    writeFileSync(join(dir, file), JSON.stringify({ model: 'm', tool, output }));
  const shareFields = ['itemId', 'thing'];
  const joinFields = ['itemId', 'move'];
  const ids = ['x-1', 'x-2'];
  const exact = request('submit_scenes', shareFields, 'today');
  save(`${cacheKey(exact)}.json`, 'submit_scenes', entries(shareFields, ids, 'exact'));
  save('old-join.json', 'submit_scenes', entries(joinFields, ids, 'join'));
  save('old-share-a.json', 'submit_scenes', entries(shareFields, ids, 'older'));
  save('old-share-b.json', 'submit_scenes', entries(shareFields, ids, 'newer'));
  save('other-tool.json', 'submit_paths', entries(shareFields, ids, 'paths'));
  const times: Record<string, number> = { 'old-share-a.json': 1, 'old-share-b.json': 2 };
  const lookup = cacheLookup(dir, (file) => times[file] ?? 0);

  it('returns the exact answer when the request hits', () => {
    expect(lookup(exact, ids)).toEqual({
      output: entries(shareFields, ids, 'exact'),
      stale: false,
    });
  });

  it('falls back to the newest older answer with the same tool, fields, and items', () => {
    const changed = request('submit_scenes', shareFields, 'yesterday');
    expect(lookup(changed, ids)).toEqual({
      output: entries(shareFields, ids, 'newer'),
      stale: true,
    });
  });

  it("never takes another tagger's answer for the same items", () => {
    const joinRequest = request('submit_scenes', joinFields, 'yesterday');
    expect(lookup(joinRequest, ids)?.output).toEqual(entries(joinFields, ids, 'join'));
    expect(lookup(request('submit_slices', shareFields, 'p'), ids)).toBeUndefined();
  });
});

describe('readReviewed', () => {
  it('treats a missing reviewed file as no tags', () => {
    expect(readReviewed(join(tmpdir(), 'no-such-dir', 'nope.json'))).toEqual({});
  });
});
