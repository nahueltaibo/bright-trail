import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { SkillSchema, type Skill } from '@bright-trail/shared';
import { ClaudeCliLlm } from '../graph/cli-llm';
import { withDiskCache, type LlmClient } from '../graph/llm';
import { loadSources } from '../graph/sources';
import { writeFormatted } from '../graph/write';
import { buildBundle, generateAll } from './pipeline';
import type { SkillContext } from './prompts';
import { renderContentReport, renderPilotReport } from './report';

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
    concurrency: { type: 'string', default: '3' },
  },
});

const graph = JSON.parse(await readFile(join(outDir, 'skills.json'), 'utf8')) as {
  skills: unknown[];
};
const skills: Skill[] = graph.skills.map((s) => SkillSchema.parse(s));
const byId = new Map(skills.map((s) => [s.id, s]));
const sources = await loadSources(join(contentDir, 'sources'));

const wanted = values.pilot
  ? PILOT_SKILLS
  : values.skills
    ? values.skills.split(',')
    : skills.map((s) => s.id);
const contexts: SkillContext[] = wanted.map((id) => {
  const skill = byId.get(id.trim());
  if (!skill) throw new Error(`Unknown skill ${id}`);
  const source = sources.find((s) => s.grade === skill.grade)!;
  return {
    skill,
    expectations: source.expectations.filter((e) => skill.expectationCodes.includes(e.code)),
    prerequisites: skill.prerequisiteIds.map((p) => byId.get(p)!),
  };
});

const live = new ClaudeCliLlm();
let liveCalls = 0;
const counted: LlmClient = {
  call: (request) => {
    liveCalls++;
    return live.call(request);
  },
};
const llm = withDiskCache(counted, join(contentDir, 'cache', 'llm'));

const run = await generateAll(contexts, llm, {
  concurrency: Number(values.concurrency),
  log: (message) => console.log(message),
});
console.log(`${liveCalls} live CLI calls, the rest came from the cache`);

if (values.pilot) {
  const file = join(outDir, 'pilot-report.md');
  await writeFormatted(file, renderPilotReport(run));
  console.log(`Wrote ${file}`);
} else if (!values.skills) {
  const bundle = buildBundle(skills, run.outcomes, new Date());
  const bundleFile = join(outDir, 'bundle.json');
  await writeFormatted(bundleFile, JSON.stringify(bundle));
  const bytes = (await readFile(bundleFile)).byteLength;
  await writeFormatted(join(outDir, 'content-report.md'), renderContentReport(skills, run, bytes));
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
