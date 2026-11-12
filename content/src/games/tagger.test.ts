import type { Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { arrayTagRequest } from '../arrays/arrays';
import { blocksTagRequest } from '../blocks/blocks';
import { compareTagRequest } from '../compare/compare';
import type { LlmClient, LlmRequest } from '../graph/llm';
import { hopsTagRequest } from '../hops/hops';
import { joinTagRequest } from '../join/join';
import { tagRequest } from '../scenes/scenes';
import { sliceTagRequest } from '../slices/slices';
import { stonesTagRequest } from '../stones/stones';
import { isTaggerKind, TAGGERS } from './registry';
import { tagItems, type Tagger } from './tagger';

const item = (id: string, skillId: string): Item =>
  ({ id, skillId, narration: id, type: 'keypad', answer: 1 }) as unknown as Item;

// Tags each candidate with its own id, and refuses ids with an "x".
const fake: Tagger<Item, string> = {
  file: 'fake.json',
  outcome: 'play the fake game',
  label: 'Fake',
  minPerSkill: 2,
  candidates: (items) => items.filter((i) => !i.id.startsWith('skip')),
  request: (skillId, items) => ({
    model: 'm',
    system: skillId,
    prompt: items.map((i) => i.id).join(','),
    tool: { name: 't', description: 'd', inputSchema: {} },
    maxTokens: 1,
  }),
  accept: (items) => ({
    tagged: Object.fromEntries(items.filter((i) => !i.id.includes('x')).map((i) => [i.id, i.id])),
    rejected: Object.fromEntries(items.filter((i) => i.id.includes('x')).map((i) => [i.id, 'no'])),
  }),
  apply: (bundle) => ({ bundle, dropped: [] }),
};

const recorder = (fail = new Set<string>()) => {
  const requests: LlmRequest[] = [];
  const llm: LlmClient = {
    call: async (request) => {
      requests.push(request);
      if (fail.has(request.system)) throw new Error('offline');
      return {};
    },
  };
  return { llm, requests };
};

describe('tagItems', () => {
  const items = [
    item('b2', 'b'),
    item('a1', 'a'),
    item('ax', 'a'),
    item('b1', 'b'),
    item('c1', 'c'),
    item('skip', 'c'),
  ];

  it('makes one call per skill with enough candidates', async () => {
    const { llm, requests } = recorder();
    await tagItems(fake, items, llm, 1);
    expect(requests.map((r) => [r.system, r.prompt])).toEqual([
      ['b', 'b2,b1'],
      ['a', 'a1,ax'],
    ]);
  });

  it('returns sorted tags and rejections, and reports each skill', async () => {
    const { llm } = recorder();
    const lines: string[] = [];
    const run = await tagItems(fake, items, llm, 2, (line) => lines.push(line));
    expect(Object.keys(run.tagged)).toEqual(['a1', 'b1', 'b2']);
    expect(run.rejected).toEqual(['ax: no']);
    expect(run.failed).toEqual([]);
    expect(lines.sort()).toEqual(['a: 1 of 2 tagged', 'b: 2 of 2 tagged']);
  });

  it('keeps going when one call fails', async () => {
    const { llm } = recorder(new Set(['a']));
    const run = await tagItems(fake, items, llm, 1);
    expect(run.failed).toEqual(['a: offline']);
    expect(Object.keys(run.tagged)).toEqual(['b1', 'b2']);
  });
});

describe('TAGGERS', () => {
  it('asks with the same requests as each game module, so cached calls still hit', () => {
    expect(TAGGERS.share.request).toBe(tagRequest);
    expect(TAGGERS.slices.request).toBe(sliceTagRequest);
    expect(TAGGERS.join.request).toBe(joinTagRequest);
    expect(TAGGERS.compare.request).toBe(compareTagRequest);
    expect(TAGGERS.arrays.request).toBe(arrayTagRequest);
    expect(TAGGERS.blocks.request).toBe(blocksTagRequest);
    expect(TAGGERS.stones.request).toBe(stonesTagRequest);
    expect(TAGGERS.hops.request).toBe(hopsTagRequest);
  });

  it('keeps one reviewed file per game', () => {
    expect(Object.values(TAGGERS).map((t) => t.file)).toEqual([
      'scenes.json',
      'slices.json',
      'join.json',
      'compare.json',
      'arrays.json',
      'blocks.json',
      'stones.json',
      'hops.json',
    ]);
  });

  it('knows its kinds', () => {
    expect(isTaggerKind('join')).toBe(true);
    expect(isTaggerKind('toString')).toBe(false);
  });
});
