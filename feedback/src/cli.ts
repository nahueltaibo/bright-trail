import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { feedbackApi } from './api';
import { file, group, pull, sync, type Context } from './commands';
import { github } from './github';
import { GROUP_BY, type GroupBy } from './issue';

const feedbackDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const COMMANDS = { pull, group, file, sync };

const USAGE = `Usage: npm run feedback:triage -- <command> [--dry-run]

  pull               Save new reports and captures to feedback/inbox/.
  group              Set groupKey on new reports.
    --by item|skill  Key by item or story card (the default), or by skill.
    --regroup        Rekey reports that already have a group.
  file               File one GitHub issue per group, then mark its reports filed.
  sync               Copy closed or reopened issue states to filed reports.

--dry-run prints what group, file, or sync would do and changes nothing.`;

const [command, ...args] = process.argv.slice(2);
const flags = new Set<string>();
let by: string = 'item';
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--by') by = args[++i] ?? '';
  else if (args[i].startsWith('--by=')) by = args[i].slice('--by='.length);
  else flags.add(args[i]);
}
const unknown = [...flags].filter((f) => f !== '--dry-run' && f !== '--regroup');
const validBy = (GROUP_BY as readonly string[]).includes(by);
if (!command || !Object.hasOwn(COMMANDS, command) || unknown.length > 0 || !validBy) {
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
  dryRun: flags.has('--dry-run'),
  regroup: flags.has('--regroup'),
  by: by as GroupBy,
};
try {
  await COMMANDS[command as keyof typeof COMMANDS](context);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
