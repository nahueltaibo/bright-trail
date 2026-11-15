import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ContentBundleSchema } from '@bright-trail/shared';
import { cacheKey } from '../graph/llm';
import { countBySkill, OUTCOMES, traceAll, type CacheLookup, type Outcome } from './coverage';
import { isTaggerKind, TAGGERS, type TaggerKind } from './registry';
import type { Tagger } from './tagger';

/**
 * Explains why bundle items have no game, from the LLM cache alone. Prints per-skill outcome
 * counts for each tagger, `--kind` for one, and `--why` to list every declined or refused item.
 */
const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cacheDir = join(contentDir, 'cache', 'llm');

const { values } = parseArgs({
  options: { kind: { type: 'string' }, why: { type: 'boolean', default: false } },
});
if (values.kind && !isTaggerKind(values.kind)) {
  console.error(`--kind must be one of: ${Object.keys(TAGGERS).join(', ')}`);
  process.exit(1);
}

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown;
const bundle = ContentBundleSchema.parse(read(join(contentDir, 'out', 'bundle.json')));
const reviewed = Object.fromEntries(
  Object.entries(TAGGERS).map(([kind, t]) => [kind, read(join(contentDir, t.file))]),
) as Record<TaggerKind, Record<string, unknown>>;

// Answers by the items they cover, for calls whose prompt changed since they were cached.
const byItems = new Map<string, unknown>();
for (const file of readdirSync(cacheDir)) {
  const { output } = read(join(cacheDir, file)) as { output: Record<string, unknown> };
  const list = Object.values(output ?? {}).find(Array.isArray) as { itemId?: string }[] | undefined;
  const ids = list?.map((e) => e.itemId).filter((id) => id !== undefined);
  if (ids?.length) byItems.set([...ids].sort().join(','), output);
}
const lookup: CacheLookup = (request, itemIds) => {
  const file = join(cacheDir, `${cacheKey(request)}.json`);
  if (existsSync(file)) return { output: (read(file) as { output: unknown }).output, stale: false };
  const output = byItems.get([...itemIds].sort().join(','));
  return output === undefined ? undefined : { output, stale: true };
};

const { traces, bundle: replayed } = traceAll(
  TAGGERS as unknown as Record<TaggerKind, Tagger>,
  bundle,
  reviewed,
  lookup,
);

const games = (b: typeof bundle) =>
  b.items.map((i) => `${i.id}:${i.game?.kind ?? ''}:${'hops' in i && i.hops ? 1 : 0}`).join();
if (games(replayed) !== games(bundle)) {
  console.log(
    'Warning: the replay plays different games than out/bundle.json. Rerun the taggers.\n',
  );
}

const SHOWN = OUTCOMES.filter((o) => o !== 'other-game');
const row = (cells: (string | number)[]) => `| ${cells.join(' | ')} |`;
const kinds = values.kind ? [values.kind as TaggerKind] : (Object.keys(TAGGERS) as TaggerKind[]);

for (const kind of kinds) {
  const trace = traces[kind];
  // Hops only ever sees number-line items, so the rest would pad its not-candidate column.
  const pool =
    kind === 'hops' ? bundle.items.filter((i) => i.type === 'number-line') : bundle.items;
  const rows = countBySkill(pool, trace);
  const total = (o: Outcome) => rows.reduce((n, r) => n + r[o], 0);
  console.log(`## ${kind}\n`);
  console.log(row(['skill', ...SHOWN]));
  console.log(row(['---', ...SHOWN.map(() => '---:')]));
  for (const r of rows) console.log(row([r.skillId, ...SHOWN.map((o) => r[o])]));
  console.log(row(['**total**', ...SHOWN.map(total)]));
  if (trace.staleSkills.length > 0) {
    console.log(`\nAnswered from an older prompt: ${trace.staleSkills.join(', ')}`);
  }
  if (values.why) {
    console.log('');
    for (const [id, fate] of [...trace.fates].sort(([a], [b]) => a.localeCompare(b))) {
      if (fate.why) console.log(`- ${fate.outcome} ${id}: ${fate.why}`);
    }
  }
  console.log('');
}

if (!values.kind) {
  // An item counts once, by the furthest any tagger got with it.
  const untagged = bundle.items.filter((i) => !i.game);
  const rank = (o: Outcome) => OUTCOMES.indexOf(o);
  const best = new Map<string, number>();
  for (const item of untagged) {
    const outcomes = Object.entries(traces)
      .filter(([kind]) => kind !== 'hops')
      .map(([, t]) => t.fates.get(item.id)!.outcome);
    const top = OUTCOMES[Math.min(...outcomes.map(rank))]!;
    best.set(top, (best.get(top) ?? 0) + 1);
  }
  console.log(`## ${untagged.length} items with no game, by the furthest a game tagger got\n`);
  for (const o of OUTCOMES) if (best.get(o)) console.log(`- ${o}: ${best.get(o)}`);
}
