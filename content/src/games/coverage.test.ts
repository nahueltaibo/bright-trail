import type { ContentBundle, Item } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { countBySkill, traceAll, traceTagger, type CacheLookup } from './coverage';
import type { Tagger } from './tagger';

const item = (id: string, skillId: string, game?: string): Item =>
  ({
    id,
    skillId,
    narration: id,
    type: 'keypad',
    answer: 1,
    ...(game && { game: { kind: game } }),
  }) as unknown as Item;

// Every item's skill is math, but skill "y", which is science.
const bundle = (items: Item[]) =>
  ({
    items,
    skills: [...new Set(items.map((i) => i.skillId))].map((id) => ({
      id,
      subject: id === 'y' ? 'science' : 'math',
    })),
  }) as unknown as ContentBundle;

// Candidates are ids without "skip". The LLM answers with the ids the cached output lists:
// "no" ids decline, "bad" ids pass the LLM but fail the check, and the rest get tagged.
const fake: Tagger<Item, string> = {
  file: 'fake.json',
  outcome: 'play the fake game',
  label: 'Fake',
  minPerSkill: 2,
  subjects: ['math'],
  candidates: (items) => items.filter((i) => !i.id.includes('skip') && !i.game),
  request: (skillId, items) => ({
    model: 'm',
    system: skillId,
    prompt: items.map((i) => i.id).join(','),
    tool: { name: 't', description: 'd', inputSchema: {} },
    maxTokens: 1,
  }),
  accept: (items, output) => {
    if (!Array.isArray(output)) throw new Error('not a list\nmore detail');
    const listed = output as string[];
    const tagged: Record<string, string> = {};
    const rejected: Record<string, string> = {};
    for (const i of items.filter((x) => listed.includes(x.id))) {
      if (i.id.includes('no')) rejected[i.id] = 'does not fit: not a fake';
      else if (i.id.includes('bad')) rejected[i.id] = 'too big';
      else tagged[i.id] = i.id;
    }
    return { tagged, rejected };
  },
  apply: (b, tags) => {
    const dropped = Object.keys(tags)
      .filter((id) => id.includes('gone'))
      .map((id) => `${id}: changed since`);
    const items = b.items.map((i) =>
      tags[i.id] && !i.id.includes('gone') && !i.id.includes('ignored')
        ? ({ ...i, game: { kind: 'fake' } } as unknown as Item)
        : i,
    );
    return { bundle: { ...b, items }, dropped };
  },
};

// Skill "a" is cached, "c" answers from an older prompt, and "d" is not cached at all.
const lookup: CacheLookup = (request, ids) => {
  if (request.system === 'a')
    return { output: ids.filter((id) => !id.includes('quiet')), stale: false };
  if (request.system === 'c') return { output: ids, stale: true };
  if (request.system === 'e') return { output: 'garbage', stale: false };
  return undefined;
};

describe('traceTagger', () => {
  const items = [
    item('a-ok', 'a'),
    item('a-no', 'a'),
    item('a-bad', 'a'),
    item('a-quiet', 'a'),
    item('a-gone', 'a'),
    item('a-skip', 'a'),
    item('b-ok', 'b'),
    item('c-ok', 'c'),
    item('c-ok2', 'c'),
    item('d-1', 'd'),
    item('d-2', 'd'),
    item('e-1', 'e'),
    item('e-2', 'e'),
    item('x-ignored', 'x'),
    item('y-1', 'y'),
    item('y-2', 'y'),
  ];
  const reviewed = {
    'a-ok': 'a-ok',
    'x-ignored': 'x-ignored',
    'a-gone': 'a-gone',
    'd-1': 'd-1',
    'c-ok': 'c-ok',
    'c-ok2': 'c-ok2',
    'y-1': 'y-1',
  };
  const { trace, bundle: after } = traceTagger(fake, bundle(items), reviewed, lookup);
  const outcome = (id: string) => trace.fates.get(id);

  it('names what happened to each item', () => {
    expect(outcome('a-ok')).toEqual({ outcome: 'tagged' });
    expect(outcome('a-no')).toEqual({ outcome: 'declined', why: 'not a fake' });
    expect(outcome('a-bad')).toEqual({ outcome: 'refused', why: 'too big' });
    expect(outcome('a-quiet')).toEqual({ outcome: 'omitted' });
    expect(outcome('a-skip')).toEqual({ outcome: 'not-candidate' });
    expect(outcome('b-ok')).toEqual({ outcome: 'few' });
    expect(outcome('d-2')).toEqual({ outcome: 'uncached' });
  });

  it('never asks about or applies tags to items of another subject', () => {
    expect(outcome('y-1')).toEqual({ outcome: 'lost', why: 'the item is science, not math' });
    expect(outcome('y-2')).toEqual({ outcome: 'not-candidate' });
  });

  it('marks a skill whose cached answer fails to parse as uncached, with the reason', () => {
    expect(outcome('e-1')).toEqual({
      outcome: 'uncached',
      why: "the cached answer doesn't parse: not a list",
    });
  });

  it('counts a reviewed tag that apply skipped as lost, not tagged', () => {
    expect(outcome('x-ignored')).toEqual({ outcome: 'lost', why: 'apply skipped it' });
  });

  it('marks a tag the bundle dropped as lost', () => {
    expect(outcome('a-gone')).toEqual({ outcome: 'lost', why: 'changed since' });
  });

  it('counts a tag kept in the reviewed file even when the cache misses', () => {
    expect(outcome('d-1')).toEqual({ outcome: 'tagged', why: 'kept from fake.json' });
  });

  it('reports skills answered from an older prompt', () => {
    expect(trace.staleSkills).toEqual(['c']);
  });

  it('returns the bundle with the reviewed tags applied', () => {
    expect(after.items.filter((i) => i.game).map((i) => i.id)).toEqual([
      'a-ok',
      'c-ok',
      'c-ok2',
      'd-1',
    ]);
  });
});

describe('traceAll', () => {
  it('replays from a bundle with no games, and marks items a later game took', () => {
    const second: Tagger<Item, string> = { ...fake, file: 'second.json', candidates: () => [] };
    const items = [item('a-ok', 'a', 'old'), item('a-skip', 'a'), item('a-x', 'a')];
    const { traces, bundle: after } = traceAll(
      { first: second, fake },
      bundle(items),
      { first: {}, fake: { 'a-ok': 'a-ok', 'a-x': 'a-x' } },
      lookup,
    );
    expect(traces.first.fates.get('a-ok')).toEqual({ outcome: 'other-game' });
    expect(traces.first.fates.get('a-skip')).toEqual({ outcome: 'not-candidate' });
    expect(traces.fake.fates.get('a-ok')).toEqual({ outcome: 'tagged' });
    expect(after.items.map((i) => i.game?.kind)).toEqual(['fake', undefined, 'fake']);
    // On the finished bundle, a-ok plays a game, so a rerun would skip skill a.
    expect(traces.fake.rerunDiffers).toEqual(['a']);
  });
});

describe('countBySkill', () => {
  it('counts outcomes per skill and skips skills the tagger never saw', () => {
    const items = [item('a1', 'a'), item('a2', 'a'), item('a3', 'a'), item('b1', 'b')];
    const fates = new Map([
      ['a1', { outcome: 'tagged' as const }],
      ['a2', { outcome: 'declined' as const }],
      ['a3', { outcome: 'not-candidate' as const }],
      ['b1', { outcome: 'not-candidate' as const }],
    ]);
    const rows = countBySkill(items, { fates, staleSkills: [], rerunDiffers: [] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ skillId: 'a', tagged: 1, declined: 1, 'not-candidate': 1 });
  });
});
