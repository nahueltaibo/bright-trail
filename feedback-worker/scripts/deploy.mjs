// Applies D1 migrations and deploys the Worker. CI runs it on every push to main.
// Needs CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, and FEEDBACK_D1_DATABASE_ID.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const names = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'FEEDBACK_D1_DATABASE_ID'];
const missing = names.filter((name) => !process.env[name]);
if (missing.length === names.length) {
  // A GitHub Actions annotation, so a skipped deploy shows on the run page.
  console.log('::warning::Cloudflare settings are unset. The feedback Worker was not deployed.');
  process.exit(0);
}
if (missing.length > 0) {
  console.error(`Missing feedback Worker settings: ${missing.join(', ')}`);
  process.exit(1);
}
const databaseId = process.env.FEEDBACK_D1_DATABASE_ID;
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(databaseId)) {
  console.error('FEEDBACK_D1_DATABASE_ID is not a D1 database id.');
  process.exit(1);
}

const dir = fileURLToPath(new URL('..', import.meta.url));
const placeholder = '00000000-0000-0000-0000-000000000000';
const config = readFileSync(`${dir}/wrangler.jsonc`, 'utf8');
if (!config.includes(placeholder)) {
  console.error('wrangler.jsonc has no database_id placeholder to fill.');
  process.exit(1);
}
// Next to the original, so its relative paths still resolve. Gitignored.
const deployConfig = `${dir}/wrangler.deploy.jsonc`;
writeFileSync(deployConfig, config.replace(placeholder, databaseId));

function wrangler(...args) {
  const result = spawnSync('npx', ['wrangler', ...args, '--config', deployConfig], {
    cwd: dir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) throw new Error(`wrangler ${args.join(' ')} failed`);
}

try {
  // Migrations go first, so the new code never meets an old schema.
  wrangler('d1', 'migrations', 'apply', 'DB', '--remote');
  wrangler('deploy');
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  rmSync(deployConfig, { force: true });
}
