import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { ContentBundleSchema } from '@bright-trail/shared';
import { cacheLookup, readReviewed } from './coverage-cache';
import { countBySkill, OUTCOMES, traceAll, type Outcome } from './coverage';
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
  Object.entries(TAGGERS).map(([kind, t]) => [kind, readReviewed(join(contentDir, t.file))]),
) as Record<TaggerKind, Record<string, unknown>>;

// The last commit that touched each cache file, so the newest of two older answers wins.
const committed = new Map<string, number>();
const log = spawnSync('git', ['log', '--format=@%ct', '--name-only', '--', cacheDir], {
  encoding: 'utf8',
});
let at = 0;
for (const line of (log.stdout ?? '').split('\n')) {
  if (line.startsWith('@')) at = Number(line.slice(1));
  else if (line && !committed.has(basename(line))) committed.set(basename(line), at);
}
const lookup = cacheLookup(cacheDir, (file) => committed.get(file) ?? Infinity);

const { traces, bundle: replayed } = traceAll(
  TAGGERS as unknown as Record<TaggerKind, Tagger>,
  bundle,
  reviewed,
  lookup,
);

const plays = (i: (typeof bundle.items)[number]) =>
  `${i.game?.kind ?? ''}${'hops' in i && i.hops ? '+hops' : ''}`;
const mismatched = bundle.items.filter((item, n) => plays(item) !== plays(replayed.items[n]!));
if (mismatched.length > 0) {
  console.log('Warning: the replay plays different games than out/bundle.json on:');
  for (const i of mismatched) console.log(`  ${i.id}`);
  console.log('Rerun the taggers. The counts below follow the replay.\n');
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
  if (trace.rerunDiffers.length > 0) {
    console.log(`\nA rerun today asks about other items in: ${trace.rerunDiffers.join(', ')}`);
  }
  if (values.why) {
    console.log('');
    for (const [id, fate] of [...trace.fates].sort(([a], [b]) => a.localeCompare(b))) {
      const listed = fate.outcome === 'declined' || fate.outcome === 'refused';
      if (listed && fate.why) console.log(`- ${fate.outcome} ${id}: ${fate.why}`);
    }
  }
  console.log('');
}

if (!values.kind) {
  // From the replay alone, so its set and outcomes agree. Each item counts by its furthest step.
  const untagged = replayed.items.filter((i) => !i.game);
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
