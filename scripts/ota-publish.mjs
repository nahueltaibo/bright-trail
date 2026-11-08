// Publishes the current JS and content to family devices as an OTA update (Android only).
// Usage: npm run ota:publish -- --message "What changed" [--no-checks]
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');
const windows = process.platform === 'win32';
const eas = 'eas-cli@27.5.0';
const channel = 'production';

const args = process.argv.slice(2);
const at = args.findIndex((a) => a === '--message' || a === '-m');
// PowerShell drops the `--`, so npm keeps --message for itself and passes it as an env var.
const message = (at >= 0 ? args[at + 1] : process.env.npm_config_message)?.trim();
if (!message) {
  console.error('Pass a message: npm run ota:publish -- --message "What changed"');
  process.exit(1);
}

// The update must match the family build's env, or the bundle differs from what the APK runs.
// Checks drop NODE_ENV: Jest fails under NODE_ENV=production.
const checkEnv = { ...process.env };
delete checkEnv.NODE_ENV;
const productionEnv = { ...process.env, NODE_ENV: 'production' };
delete productionEnv.EXPO_PUBLIC_E2E;

// shell: true joins args with spaces, so quote each one for cmd.exe or sh.
const quote = (a) => (/^[\w@./:=-]+$/.test(a) ? a : `"${a.replaceAll('"', '\\"')}"`);

function run(command, argv, { cwd = root, capture = false, env = checkEnv } = {}) {
  console.log(`> ${command} ${argv.join(' ')}`);
  return spawnSync(command, argv.map(quote), {
    cwd,
    env,
    shell: windows,
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  });
}

const who = run('npx', ['-y', eas, 'whoami'], { cwd: app, capture: true });
const account = `${who.stdout ?? ''}`.trim().split(/\r?\n/)[0];
if (who.status !== 0 || !account || /not logged in/i.test(`${who.stdout}${who.stderr}`)) {
  console.error(`Not logged in to Expo. Run: npx -y ${eas} login`);
  process.exit(1);
}
console.log(`Logged in as ${account}.`);

if (run('node', ['scripts/release.mjs', '--require-ota']).status !== 0) {
  console.error('Nothing was published.');
  process.exit(1);
}

// CI passes --no-checks because its earlier job already ran them.
for (const script of args.includes('--no-checks') ? [] : ['lint', 'typecheck', 'test']) {
  if (run('npm', ['run', script]).status !== 0) {
    console.error(`npm run ${script} failed. Nothing was published.`);
    process.exit(1);
  }
}

const result = run(
  'npx',
  [
    '-y',
    eas,
    'update',
    '--channel',
    channel,
    '--platform',
    'android',
    '--environment',
    'production',
    '--message',
    message,
    '--non-interactive',
  ],
  { cwd: app, env: productionEnv },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(
  `Published to ${channel}. Devices get it on their next launch and apply it after that.`,
);
