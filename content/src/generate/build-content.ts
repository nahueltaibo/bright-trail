import { access, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SkillSchema, type Skill } from '@bright-trail/shared';
import { ClaudeCliLlm } from '../graph/cli-llm';
import { cacheKey, withDiskCache, type LlmClient } from '../graph/llm';
import { loadAllSources } from '../graph/sources';
import { writeFormatted } from '../graph/write';
import { writeBundle } from '../packs/write-packs';
import { loadEdits } from './edits';
import { buildBundle, generateAll, MAX_RETRIES } from './pipeline';
import { generateRequest, type SkillContext } from './prompts';
import { loadScope, prerequisiteClosure } from './scope';
import { renderContentReport, renderPilotReport } from './report';
import { TAGGERS } from '../games/registry';
import type { Tagger } from '../games/tagger';

/** Skills the testers will meet first: 2 Kindergarten, 2 Grade 1, 1 Grade 5, 1 Grade 6, across topics. */
const PILOT_SKILLS = [
  'k-estimate-and-count',
  'k-add-sub-facts-5',
  'g1-mental-math-20',
  'g1-half-equals-two-fourths',
  'g5-fraction-decimal-percent',
  'g6-integers',
];

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(contentDir, 'out');

const { values } = parseArgs({
  options: {
    pilot: { type: 'boolean', default: false },
    skills: { type: 'string' },
    /** Every skill in the graph, ignoring bundle-scope.json. */
    all: { type: 'boolean', default: false },
    concurrency: { type: 'string', default: '3' },
    /** Cached responses only: a miss fails that skill instead of calling the CLI. */
    offline: { type: 'boolean', default: false },
  },
});

const graph = JSON.parse(await readFile(join(outDir, 'skills.json'), 'utf8')) as {
  skills: unknown[];
};
const skills: Skill[] = graph.skills.map((s) => SkillSchema.parse(s));
const byId = new Map(skills.map((s) => [s.id, s]));
const sources = await loadAllSources(join(contentDir, 'sources'));

const scope = await loadScope(join(contentDir, 'bundle-scope.json'));
const bundleSkills = values.all ? skills : prerequisiteClosure(skills, scope.targets);
const wanted = values.pilot
  ? PILOT_SKILLS
  : values.skills
    ? values.skills.split(',')
    : bundleSkills.map((s) => s.id);
const contextOf = (id: string): SkillContext => {
  const skill = byId.get(id.trim());
  if (!skill) throw new Error(`Unknown skill ${id}`);
  const source = sources.get(skill.subject)!.find((s) => s.grade === skill.grade)!;
  return {
    skill,
    expectations: source.expectations.filter((e) => skill.expectationCodes.includes(e.code)),
    prerequisites: skill.prerequisiteIds.map((p) => byId.get(p)!),
  };
};
const contexts = wanted.map(contextOf);

const edits = await loadEdits(join(contentDir, 'content-edits.json'));
const unknownEdits = edits.filter((e) => !byId.has(e.skillId));
if (unknownEdits.length > 0) {
  throw new Error(`Edits name unknown skills: ${unknownEdits.map((e) => e.skillId).join(', ')}`);
}

const cacheDir = join(contentDir, 'cache', 'llm');

/** Skills whose first generate call is already cached, so adding them as targets costs little. */
async function countGenerated(outside: readonly Skill[]): Promise<number> {
  let n = 0;
  for (const skill of outside) {
    const file = join(cacheDir, `${cacheKey(generateRequest(contextOf(skill.id)))}.json`);
    if (
      await access(file).then(
        () => true,
        () => false,
      )
    )
      n++;
  }
  return n;
}

const live = new ClaudeCliLlm();
let liveCalls = 0;
const counted: LlmClient = {
  call: (request) => {
    if (values.offline) return Promise.reject(new Error(`Not cached: ${cacheKey(request)}`));
    liveCalls++;
    return live.call(request);
  },
};
const llm = withDiskCache(counted, cacheDir);

const run = await generateAll(contexts, llm, {
  concurrency: Number(values.concurrency),
  maxRetries: (id) => MAX_RETRIES + (scope.extraRetries[id] ?? 0),
  edits: (id) => edits.filter((e) => e.skillId === id),
  log: (message) => console.log(message),
});
console.log(`${liveCalls} live CLI calls, the rest came from the cache`);

if (values.pilot) {
  const file = join(outDir, 'pilot-report.md');
  await writeFormatted(file, renderPilotReport(run));
  console.log(`Wrote ${file}`);
} else if (!values.skills) {
  // Tags from `npm run content:games` survive regeneration while their items still match.
  let bundle = buildBundle(bundleSkills, run.outcomes, new Date());
  for (const tagger of Object.values(TAGGERS) as Tagger[]) {
    const stored = await readFile(join(contentDir, tagger.file), 'utf8').catch(() => '{}');
    const applied = tagger.apply(bundle, JSON.parse(stored));
    for (const d of applied.dropped) console.warn(`${tagger.label} dropped: ${d}`);
    bundle = applied.bundle;
  }
  const bundleFile = join(outDir, 'bundle.json');
  await writeBundle(bundleFile, bundle);
  const bytes = (await readFile(bundleFile)).byteLength;
  await writeFormatted(
    join(outDir, 'content-report.md'),
    renderContentReport(bundleSkills, run, bytes, {
      targets: values.all ? [] : scope.targets,
      generatedOutside: await countGenerated(skills.filter((s) => !bundleSkills.includes(s))),
      extraRetries: scope.extraRetries,
    }),
  );
  console.log(
    `Wrote ${bundle.nuggets.length} stories and ${bundle.items.length} items to ${bundleFile} (${(bytes / 1024).toFixed(0)} KB)`,
  );
}

const failed = run.outcomes.filter((o) => o.status === 'failed');
for (const o of failed)
  console.error(`Failed: ${o.skill.id}: ${o.attempts.at(-1)?.problems.join('; ')}`);
if (run.stoppedBy) {
  console.error(`Stopped early: ${run.stoppedBy}`);
  console.error(`${run.pending.length} skills left. Rerun after the limit resets to resume.`);
  process.exitCode = 2;
} else if (failed.length > 0) {
  process.exitCode = 1;
}
