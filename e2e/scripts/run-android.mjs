// Installs the e2e APK and runs every flow. Usage: npm run e2e:android -- [--device <serial>]
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKS_PORT, servePacks } from '../../scripts/serve-packs.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const apk = join(root, 'e2e', 'output', 'bright-trail-e2e.apk');
const out = join(root, 'e2e', 'output');
const windows = process.platform === 'win32';
const adb = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb')
  : 'adb';

const args = process.argv.slice(2);
const at = args.indexOf('--device');
const device = at >= 0 ? args[at + 1] : process.env.ANDROID_SERIAL;
const extra = at >= 0 ? [...args.slice(0, at), ...args.slice(at + 2)] : args;

function run(command, argv) {
  console.log(`> ${command} ${argv.join(' ')}`);
  const result = spawnSync(command, argv, { cwd: root, stdio: 'inherit', shell: windows });
  return result.status ?? 1;
}

if (!existsSync(apk)) {
  console.error(`No APK at ${apk}. Run npm run e2e:build:android first.`);
  process.exit(1);
}

if (run(adb, [...(device ? ['-s', device] : []), 'install', '-r', apk]) !== 0) process.exit(1);

// The e2e APK downloads packs from localhost:8090, which adb forwards to this machine.
const server = await servePacks();
const reverse = ['reverse', `tcp:${PACKS_PORT}`, `tcp:${PACKS_PORT}`];
if (run(adb, [...(device ? ['-s', device] : []), ...reverse]) !== 0) process.exit(1);

const status = run('maestro', [
  ...(device ? ['--device', device] : []),
  'test',
  '--test-output-dir',
  join(out, 'maestro'),
  '--debug-output',
  join(out, 'debug'),
  ...extra,
  join(root, 'e2e'),
]);
server.close();
process.exit(status);
