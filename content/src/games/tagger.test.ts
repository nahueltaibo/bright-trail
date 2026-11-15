import type { Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { arrayTagRequest } from '../arrays/arrays';
import { blocksTagRequest } from '../blocks/blocks';
import { compareTagRequest } from '../compare/compare';
import type { LlmClient, LlmRequest } from '../graph/llm';
import { gridTagRequest } from '../grid/grid';
import { wallTagRequest } from '../wall/wall';
import { hopsTagRequest } from '../hops/hops';
import { joinTagRequest } from '../join/join';
import { labelTagRequest } from '../label/label';
import { lineupTagRequest } from '../lineup/lineup';
import { orderTagRequest } from '../order/order';
import { tagRequest } from '../scenes/scenes';
import { sliceTagRequest } from '../slices/slices';
import { stonesTagRequest } from '../stones/stones';
import { isTaggerKind, TAGGERS } from './registry';
import { groupCandidates, tagItems, type Tagger } from './tagger';

const item = (id: string, skillId: string): Item =>
  ({ id, skillId, narration: id, type: 'keypad', answer: 1 }) as unknown as Item;

// Tags each candidate with its own id, and refuses ids with an "x".
const fake: Tagger<Item, string> = {
  file: 'fake.json',
  outcome: 'play the fake game',
  label: 'Fake',
  minPerSkill: 2,
  subjects: ['math'],
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

const math = (...ids: string[]) => ids.map((id) => ({ id, subject: 'math' as const }));

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
  const skills = math('a', 'b', 'c');

  it('makes one call per skill with enough candidates', async () => {
    const { llm, requests } = recorder();
    await tagItems(fake, items, skills, llm, 1);
    expect(requests.map((r) => [r.system, r.prompt])).toEqual([
      ['b', 'b2,b1'],
      ['a', 'a1,ax'],
    ]);
  });

  it('returns sorted tags and rejections, and reports each skill', async () => {
    const { llm } = recorder();
    const lines: string[] = [];
    const run = await tagItems(fake, items, skills, llm, 2, (line) => lines.push(line));
    expect(Object.keys(run.tagged)).toEqual(['a1', 'b1', 'b2']);
    expect(run.rejected).toEqual(['ax: no']);
    expect(run.failed).toEqual([]);
    expect(lines.sort()).toEqual(['a: 1 of 2 tagged', 'b: 2 of 2 tagged']);
  });

  it('keeps going when one call fails', async () => {
    const { llm } = recorder(new Set(['a']));
    const run = await tagItems(fake, items, skills, llm, 1);
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
    expect(TAGGERS.grid.request).toBe(gridTagRequest);
    expect(TAGGERS.blocks.request).toBe(blocksTagRequest);
    expect(TAGGERS.stones.request).toBe(stonesTagRequest);
    expect(TAGGERS.lineup.request).toBe(lineupTagRequest);
    expect(TAGGERS.wall.request).toBe(wallTagRequest);
    expect(TAGGERS.label.request).toBe(labelTagRequest);
    expect(TAGGERS.order.request).toBe(orderTagRequest);
    expect(TAGGERS.hops.request).toBe(hopsTagRequest);
  });

  it('keeps one reviewed file per game', () => {
    expect(Object.values(TAGGERS).map((t) => t.file)).toEqual([
      'scenes.json',
      'slices.json',
      'join.json',
      'compare.json',
      'arrays.json',
      'grid.json',
      'blocks.json',
      'stones.json',
      'lineup.json',
      'wall.json',
      'label.json',
      'order.json',
      'hops.json',
    ]);
  });

  it('keeps math games on math items', () => {
    const subjects = Object.fromEntries(Object.entries(TAGGERS).map(([k, t]) => [k, t.subjects]));
    const math = ['share', 'slices', 'join', 'compare', 'arrays', 'grid', 'blocks', 'stones'];
    for (const kind of [...math, 'lineup', 'wall', 'hops'])
      expect(subjects[kind]).toEqual(['math']);
  });

  it('knows its kinds', () => {
    expect(isTaggerKind('join')).toBe(true);
    expect(isTaggerKind('toString')).toBe(false);
  });
});

describe('groupCandidates', () => {
  it('groups candidates by skill and sets aside skills below minPerSkill', () => {
    const items = [item('a1', 'a'), item('b1', 'b'), item('a2', 'a'), item('skip', 'b')];
    const { bySkill, few } = groupCandidates(fake, items, math('a', 'b'));
    expect([...bySkill].map(([s, g]) => [s, g.map((i) => i.id)])).toEqual([['a', ['a1', 'a2']]]);
    expect(few.map((i) => i.id)).toEqual(['b1']);
  });

  it('skips items of other subjects and of unknown skills before candidates', () => {
    const seen: string[] = [];
    const candidates = (items: readonly Item[]) => {
      seen.push(...items.map((i) => i.id));
      return [...items];
    };
    const items = [item('m1', 'm'), item('s1', 's'), item('u1', 'u'), item('m2', 'm')];
    const skills = [...math('m'), { id: 's', subject: 'science' as const }];
    const { bySkill } = groupCandidates({ ...fake, candidates }, items, skills);
    expect(seen).toEqual(['m1', 'm2']);
    expect([...bySkill.keys()]).toEqual(['m']);
    const science = { ...fake, candidates, subjects: ['science' as const] };
    expect(groupCandidates(science, items, skills).few.map((i) => i.id)).toEqual(['s1']);
  });
});
