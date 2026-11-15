import type { ContentBundle, Item } from '@bright-trail/shared';
import type { LlmRequest } from '../graph/llm';
import type { Tagger } from './tagger';

/** What happened to one item in one tagger's run. */
export type Outcome =
  | 'tagged'
  | 'lost'
  | 'refused'
  | 'declined'
  | 'omitted'
  | 'uncached'
  | 'few'
  | 'other-game'
  | 'not-candidate';

export const OUTCOMES: readonly Outcome[] = [
  'tagged',
  'lost',
  'refused',
  'declined',
  'omitted',
  'uncached',
  'few',
  'other-game',
  'not-candidate',
];

export type Fate = { outcome: Outcome; why?: string };

/** A cached answer for one skill's call, and whether it came from an older prompt. */
export type Cached = { output: unknown; stale: boolean };

/**
 * Finds the cached answer for a request. `stale` means the exact request missed, but an answer
 * for the same items exists, so the prompt changed since that call.
 */
export type CacheLookup = (request: LlmRequest, itemIds: readonly string[]) => Cached | undefined;

export type TaggerTrace = {
  /** Each item's fate, by id. Every bundle item has one. */
  fates: Map<string, Fate>;
  /** Skills whose call answered from an older prompt. */
  staleSkills: string[];
};

/**
 * Replays one tagger's run from the cache without calling the LLM: which items it asked about,
 * what the LLM said, what its accept check refused, and what the bundle kept.
 */
export function traceTagger<I extends Item, G>(
  tagger: Tagger<I, G>,
  bundle: ContentBundle,
  reviewed: Readonly<Record<string, G>>,
  lookup: CacheLookup,
): { trace: TaggerTrace; bundle: ContentBundle } {
  const fates = new Map<string, Fate>();
  const staleSkills: string[] = [];
  const bySkill = new Map<string, I[]>();
  for (const item of tagger.candidates(bundle.items)) {
    bySkill.set(item.skillId, [...(bySkill.get(item.skillId) ?? []), item]);
  }
  for (const [skillId, group] of bySkill) {
    if (group.length < tagger.minPerSkill) {
      for (const i of group) fates.set(i.id, { outcome: 'few' });
      continue;
    }
    const ids = group.map((i) => i.id);
    const cached = lookup(tagger.request(skillId, group), ids);
    if (!cached) {
      for (const i of group) fates.set(i.id, { outcome: 'uncached' });
      continue;
    }
    if (cached.stale) staleSkills.push(skillId);
    const { tagged, rejected } = tagger.accept(group, cached.output);
    for (const i of group) {
      const why = rejected[i.id];
      if (i.id in tagged) fates.set(i.id, { outcome: 'tagged' });
      else if (why?.startsWith('does not fit: ')) {
        fates.set(i.id, { outcome: 'declined', why: why.slice('does not fit: '.length) });
      } else if (why !== undefined) fates.set(i.id, { outcome: 'refused', why });
      else fates.set(i.id, { outcome: 'omitted' });
    }
  }

  const applied = tagger.apply(bundle, reviewed);
  const lost = new Map(
    applied.dropped.map((line) => {
      const at = line.indexOf(': ');
      return [line.slice(0, at), line.slice(at + 2)] as const;
    }),
  );
  for (const item of bundle.items) {
    const fate = fates.get(item.id);
    const inFile = Object.hasOwn(reviewed, item.id);
    if (inFile && !lost.has(item.id)) {
      // The reviewed file wins: a tag can outlive the cached call that made it.
      if (fate?.outcome !== 'tagged') {
        fates.set(item.id, { outcome: 'tagged', why: `kept from ${tagger.file}` });
      }
    } else if (fate?.outcome === 'tagged') {
      fates.set(item.id, { outcome: 'lost', why: lost.get(item.id) ?? `not in ${tagger.file}` });
    } else if (!fate) {
      fates.set(item.id, { outcome: item.game ? 'other-game' : 'not-candidate' });
    }
  }
  return { trace: { fates, staleSkills }, bundle: applied.bundle };
}

/** Drops every game and frog path, so a replay starts from the generated items. */
export function stripGames(bundle: ContentBundle): ContentBundle {
  const items = bundle.items.map((item) => {
    const rest = { ...item } as Record<string, unknown>;
    delete rest.game;
    delete rest.hops;
    return rest as Item;
  });
  return { ...bundle, items };
}

/**
 * Replays every tagger in bundle order, each on the bundle the ones before it left. An item a
 * tagger never saw counts as `other-game` when some game plays it in the end.
 */
export function traceAll<K extends string>(
  taggers: Readonly<Record<K, Tagger>>,
  bundle: ContentBundle,
  reviewed: Readonly<Record<K, Readonly<Record<string, unknown>>>>,
  lookup: CacheLookup,
): { traces: Record<K, TaggerTrace>; bundle: ContentBundle } {
  let current = stripGames(bundle);
  const traces = {} as Record<K, TaggerTrace>;
  for (const kind of Object.keys(taggers) as K[]) {
    const run = traceTagger(taggers[kind], current, reviewed[kind], lookup);
    traces[kind] = run.trace;
    current = run.bundle;
  }
  const played = new Set(current.items.filter((i) => i.game).map((i) => i.id));
  for (const { fates } of Object.values<TaggerTrace>(traces)) {
    for (const [id, fate] of fates) {
      if (fate.outcome === 'not-candidate' && played.has(id))
        fates.set(id, { outcome: 'other-game' });
    }
  }
  return { traces, bundle: current };
}

export type SkillCounts = { skillId: string } & Record<Outcome, number>;

/**
 * Counts outcomes per skill. Lists only skills with a candidate or an untagged item the tagger
 * never saw, and leaves out items another game already plays.
 */
export function countBySkill(items: readonly Item[], trace: TaggerTrace): SkillCounts[] {
  const rows = new Map<string, SkillCounts>();
  for (const item of items) {
    const { outcome } = trace.fates.get(item.id) ?? { outcome: 'not-candidate' };
    let row = rows.get(item.skillId);
    if (!row) {
      row = {
        skillId: item.skillId,
        ...Object.fromEntries(OUTCOMES.map((o) => [o, 0])),
      } as SkillCounts;
      rows.set(item.skillId, row);
    }
    row[outcome]++;
  }
  const seen = (r: SkillCounts) =>
    OUTCOMES.some((o) => o !== 'not-candidate' && o !== 'other-game' && r[o] > 0);
  return [...rows.values()].filter(seen).sort((a, b) => a.skillId.localeCompare(b.skillId));
}
