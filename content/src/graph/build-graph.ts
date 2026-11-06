import { rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AnthropicLlm, withDiskCache } from './llm';
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
  // No .env: the SDK falls back to ANTHROPIC_API_KEY or another credential in the environment.
}

const sources = await loadSources(join(contentDir, 'sources'));
const llm = withDiskCache(new AnthropicLlm(), join(contentDir, 'cache', 'llm'));
const build = await buildGraph(sources, llm, { log: (message) => console.log(message) }).catch(
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    console.error('Calls already answered are cached, so a rerun resumes where this one stopped.');
    console.error('The API key comes from ANTHROPIC_API_KEY, in the environment or the root .env.');
    process.exit(1);
  },
);

await writeFormatted(reportFile, renderReport(build));
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
