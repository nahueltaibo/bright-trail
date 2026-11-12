import { rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ClaudeCliLlm } from './cli-llm';
import { AnthropicLlm, withDiskCache, type LlmClient } from './llm';
import { loadOverrides } from './overrides';
import { buildGraph } from './pipeline';
import { GENERATOR_MODEL, REVIEWER_MODEL } from './prompts';
import { renderReport } from './report';
import { loadSources } from './sources';
import { writeFormatted } from './write';

const contentDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(contentDir, 'out');
const skillsFile = join(outDir, 'skills.json');
const reportFile = join(outDir, 'skills-report.md');

try {
  process.loadEnvFile(join(contentDir, '..', '.env'));
} catch {
  // No .env is fine: the default CLI backend uses the Claude Code login.
}

// `cli` runs on the Claude Code login. `sdk` calls the API with ANTHROPIC_API_KEY, which is billed.
const backend = process.env.LLM_BACKEND ?? 'cli';
if (backend !== 'cli' && backend !== 'sdk') throw new Error(`Unknown LLM_BACKEND ${backend}`);

const sources = await loadSources(join(contentDir, 'sources', 'math'), 'math');
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
const build = await buildGraph(sources, llm, {
  overrides,
  log: (message) => console.log(message),
}).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  console.error('Calls already answered are cached, so a rerun resumes where this one stopped.');
  process.exit(1);
});

console.log(`${liveCalls} ${backend} calls, the rest came from the cache`);
await writeFormatted(reportFile, renderReport(build));
for (const warning of build.warnings) console.warn(`Warning: ${warning.message}`);
if (build.problems.length > 0) {
  // A stale skills.json would look valid to the next build step.
  await rm(skillsFile, { force: true });
  console.error(`${build.problems.length} problems. See ${reportFile}`);
  for (const problem of build.problems) console.error(`  ${problem.message}`);
  process.exitCode = 1;
} else {
  await writeFormatted(
    skillsFile,
    JSON.stringify({
      models: { generator: GENERATOR_MODEL, reviewer: REVIEWER_MODEL },
      skills: build.skills,
    }),
  );
  console.log(
    `Wrote ${build.skills.length} skills to ${skillsFile} and the report to ${reportFile}`,
  );
}
