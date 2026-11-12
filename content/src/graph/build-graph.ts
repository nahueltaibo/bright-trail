import { rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClaudeCliLlm } from './cli-llm';
import { AnthropicLlm, withDiskCache, type LlmClient } from './llm';
import { loadOverrides } from './overrides';
import { buildGraph, mergeBuilds } from './pipeline';
import { GENERATOR_MODEL, REVIEWER_MODEL } from './prompts';
import { renderReport } from './report';
import { loadAllSources, subjectOfId } from './sources';
import { writeFormatted } from './write';

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(contentDir, 'out');
const skillsFile = join(outDir, 'skills.json');
const reportFile = (subject: string) =>
  join(outDir, subject === 'math' ? 'skills-report.md' : `skills-report-${subject}.md`);

try {
  process.loadEnvFile(join(contentDir, '..', '.env'));
} catch {
  // No .env is fine: the default CLI backend uses the Claude Code login.
}

// `cli` runs on the Claude Code login. `sdk` calls the API with ANTHROPIC_API_KEY, which is billed.
const backend = process.env.LLM_BACKEND ?? 'cli';
if (backend !== 'cli' && backend !== 'sdk') throw new Error(`Unknown LLM_BACKEND ${backend}`);

const sources = await loadAllSources(join(contentDir, 'sources'));
const overrides = await loadOverrides(join(contentDir, 'graph-overrides.json'));
const live = backend === 'sdk' ? new AnthropicLlm() : new ClaudeCliLlm();
let liveCalls = 0;
const counted: LlmClient = {
  call: (request) => {
    liveCalls++;
    return live.call(request);
  },
};
const llm = withDiskCache(counted, join(contentDir, 'cache', 'llm'));
// Subjects don't share skills, so each builds on its own and they run side by side.
const builds = await Promise.all(
  [...sources].map(async ([subject, subjectSources]) => {
    const build = await buildGraph(subjectSources, llm, {
      overrides: overrides.filter((o) => subjectOfId(o.skillId) === subject),
      log: (message) => console.log(`${subject}: ${message}`),
    });
    return { subject, build };
  }),
).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  console.error('Calls already answered are cached, so a rerun resumes where this one stopped.');
  process.exit(1);
});
const graph = mergeBuilds(builds.map((b) => b.build));

console.log(`${liveCalls} ${backend} calls, the rest came from the cache`);
for (const { subject, build } of builds) {
  const title = subject === 'math' ? undefined : `Skill Graph Report: ${subject}`;
  await writeFormatted(reportFile(subject), renderReport(build, title));
  for (const warning of build.warnings) console.warn(`Warning: ${subject}: ${warning.message}`);
}
if (graph.problems.length > 0) {
  // A stale skills.json would look valid to the next build step.
  await rm(skillsFile, { force: true });
  console.error(`${graph.problems.length} problems. See the skills-report files in ${outDir}`);
  for (const problem of graph.problems) console.error(`  ${problem.message}`);
  process.exitCode = 1;
} else {
  await writeFormatted(
    skillsFile,
    JSON.stringify({
      models: { generator: GENERATOR_MODEL, reviewer: REVIEWER_MODEL },
      skills: graph.skills,
    }),
  );
  console.log(`Wrote ${graph.skills.length} skills to ${skillsFile} and the reports to ${outDir}`);
}
