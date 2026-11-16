import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedbackApi } from './api';
import { file, group, pull, sync, type Context } from './commands';
import { github } from './github';

const feedbackDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const COMMANDS = { pull, group, file, sync };

const USAGE = `Usage: npm run feedback:triage -- <command> [--dry-run]

  pull               Save new reports and captures to feedback/inbox/.
  group [--regroup]  Set groupKey on new reports. --regroup rekeys grouped ones too.
  file               File one GitHub issue per group, then mark its reports filed.
  sync               Copy closed or reopened issue states to filed reports.

--dry-run prints what group, file, or sync would do and changes nothing.`;

const [command, ...flags] = process.argv.slice(2);
const unknown = flags.filter((f) => f !== '--dry-run' && f !== '--regroup');
if (!command || !Object.hasOwn(COMMANDS, command) || unknown.length > 0) {
  console.error(USAGE);
  process.exit(1);
}

try {
  process.loadEnvFile(join(feedbackDir, '..', '.env'));
} catch {
  // No .env is fine when the variables are already set.
}
const { FEEDBACK_URL, FEEDBACK_ADMIN_TOKEN } = process.env;
if (!FEEDBACK_URL || !FEEDBACK_ADMIN_TOKEN) {
  console.error('Set FEEDBACK_URL and FEEDBACK_ADMIN_TOKEN in .env or the environment.');
  process.exit(1);
}

const context: Context = {
  api: feedbackApi({ baseUrl: FEEDBACK_URL, token: FEEDBACK_ADMIN_TOKEN }),
  github: github(),
  log: (line) => console.log(line),
  inbox: join(feedbackDir, 'inbox'),
  dryRun: flags.includes('--dry-run'),
  regroup: flags.includes('--regroup'),
};
await COMMANDS[command as keyof typeof COMMANDS](context);
