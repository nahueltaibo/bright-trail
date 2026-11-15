import type { ContentBundle, Item } from '@bright-trail/shared';
import type { LlmRequest } from '../graph/llm';
import { groupCandidates, type Tagger } from './tagger';

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
  /** Skills whose candidates differ on the finished bundle, so a rerun today asks another call. */
  rerunDiffers: string[];
};

/** Whether `apply` set this tagger's game or frog path on the item. */
const changed = (before: Item, after: Item) =>
  before.game !== after.game ||
  ('hops' in before ? before.hops : undefined) !== ('hops' in after ? after.hops : undefined);

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
  const { bySkill, few } = groupCandidates(tagger, bundle.items, bundle.skills);
  for (const i of few) fates.set(i.id, { outcome: 'few' });
  for (const [skillId, group] of bySkill) {
    const cached = lookup(
      tagger.request(skillId, group),
      group.map((i) => i.id),
    );
    let result: ReturnType<typeof tagger.accept> | undefined;
    let broken: string | undefined;
    if (cached) {
      try {
        result = tagger.accept(group, cached.output);
      } catch (error) {
        broken = `the cached answer doesn't parse: ${(error as Error).message.split('\n')[0]}`;
      }
    }
    if (!result) {
      for (const i of group)
        fates.set(i.id, { outcome: 'uncached', ...(broken && { why: broken }) });
      continue;
    }
    if (cached?.stale) staleSkills.push(skillId);
    for (const i of group) {
      const why = result.rejected[i.id];
      if (i.id in result.tagged) fates.set(i.id, { outcome: 'tagged' });
      else if (why?.startsWith('does not fit: ')) {
        fates.set(i.id, { outcome: 'declined', why: why.slice('does not fit: '.length) });
      } else if (why !== undefined) fates.set(i.id, { outcome: 'refused', why });
      else fates.set(i.id, { outcome: 'omitted' });
    }
  }

  const applied = tagger.apply(bundle, reviewed);
  const dropped = new Map(
    applied.dropped.map((line) => {
      const at = line.indexOf(': ');
      return [line.slice(0, at), line.slice(at + 2)] as const;
    }),
  );
  bundle.items.forEach((item, n) => {
    const fate = fates.get(item.id);
    if (changed(item, applied.bundle.items[n]!)) {
      // The reviewed file wins: a tag can outlive the cached call that made it.
      if (fate?.outcome !== 'tagged') {
        fates.set(item.id, { outcome: 'tagged', why: `kept from ${tagger.file}` });
      }
    } else if (fate?.outcome === 'tagged' || Object.hasOwn(reviewed, item.id)) {
      const why =
        dropped.get(item.id) ??
        (Object.hasOwn(reviewed, item.id) ? 'apply skipped it' : `not in ${tagger.file}`);
      fates.set(item.id, { outcome: 'lost', why });
    } else if (!fate) {
      fates.set(item.id, { outcome: item.game ? 'other-game' : 'not-candidate' });
    }
  });
  return { trace: { fates, staleSkills, rerunDiffers: [] }, bundle: applied.bundle };
}

function differingSkills(a: Map<string, Item[]>, b: Map<string, Item[]>): string[] {
  const ids = (m: Map<string, Item[]>, skill: string) =>
    (m.get(skill) ?? []).map((i) => i.id).join();
  const skills = new Set([...a.keys(), ...b.keys()]);
  return [...skills].filter((s) => ids(a, s) !== ids(b, s)).sort();
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
 * Replays every tagger in bundle order, each on the bundle the ones before it left. Each game was
 * first tagged after the ones before it existed, and candidate filters skip items another game
 * plays, so this order is what those runs saw. `rerunDiffers` names the skills where a run on the
 * finished bundle would ask about other items. An item a tagger never saw counts as `other-game`
 * when some game plays it in the end.
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
    const tagger = taggers[kind];
    const run = traceTagger(tagger, current, reviewed[kind], lookup);
    run.trace.rerunDiffers = differingSkills(
      groupCandidates(tagger, current.items, current.skills).bySkill,
      groupCandidates(tagger, bundle.items, bundle.skills).bySkill,
    );
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
 * Counts outcomes per skill. Lists only skills where the tagger had a candidate. Items another
 * game plays count as `other-game`.
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
