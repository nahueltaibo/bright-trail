// Installs the newest family APK over USB, keeping the app's data.
// Usage: npm run android:install -- [--device <serial>] [--apk <path>]
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const pkg = 'com.nahueltaibo.brighttrail';
const adb = process.env.ANDROID_HOME
  ? join(process.env.ANDROID_HOME, 'platform-tools', 'adb')
  : 'adb';

const args = process.argv.slice(2);
const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const device = option('--device') ?? process.env.ANDROID_SERIAL;
const target = device ? ['-s', device] : [];

function newestApk() {
  if (!existsSync(dist)) return null;
  const apks = readdirSync(dist)
    .filter((f) => f.startsWith('bright-trail-') && f.endsWith('.apk'))
    .map((f) => join(dist, f))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return apks[0] ?? null;
}

function adbRun(argv) {
  console.log(`> adb ${[...target, ...argv].join(' ')}`);
  const result = spawnSync(adb, [...target, ...argv], { encoding: 'utf8' });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  process.stdout.write(output);
  return { ok: result.status === 0, output };
}

const apk = option('--apk') ?? newestApk();
if (!apk || !existsSync(apk)) {
  console.error('No family APK found. Run npm run android:build:family first.');
  process.exit(1);
}

let result = adbRun(['install', '-r', apk]);
if (result.ok) {
  console.log(`Installed ${apk}. Progress on the device was kept.`);
  process.exit(0);
}

if (/INSTALL_FAILED_VERSION_DOWNGRADE/.test(result.output)) {
  console.error('\nThe device has a newer build than this APK. Build from a newer checkout.');
  process.exit(1);
}

if (!/INSTALL_FAILED_UPDATE_INCOMPATIBLE|signatures do not match/i.test(result.output)) {
  console.error('\nInstall failed. See the adb output above.');
  process.exit(1);
}

console.error(`
The installed BrightTrail was signed with a different key, so Android won't upgrade it.
That happens when a build from another computer or another keystore is on the device.
The only fix is to uninstall it first. That DELETES everything on this device:
children, progress, flags, and the parent PIN. Export the data from the parent area first.`);

if (!process.stdin.isTTY) {
  console.error(`\nTo go ahead anyway, run: adb ${[...target, 'uninstall', pkg].join(' ')}`);
  console.error('Then rerun this script.');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const answer = await rl.question(
  '\nType "delete" to uninstall and reinstall, anything else to stop: ',
);
rl.close();
if (answer.trim() !== 'delete') {
  console.log('Stopped. Nothing was changed.');
  process.exit(1);
}

if (!adbRun(['uninstall', pkg]).ok) process.exit(1);
result = adbRun(['install', apk]);
if (!result.ok) process.exit(1);
console.log(`Installed ${apk} on a clean app. Set up the parent PIN and children again.`);
