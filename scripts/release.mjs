// Decides how a change reaches family devices: a new APK on a major version bump, an OTA update
// otherwise. Fails when the native side changed without a major bump, since an OTA update would
// then run JS the installed APK can't support.
// Usage: node scripts/release.mjs [--fingerprint | --require-ota]. Needs a logged-in `gh`.
import { createFingerprintAsync } from '@expo/fingerprint';
import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');
const FINGERPRINT_ASSET = 'fingerprint.txt';

// app.config.js reads EXPO_PUBLIC_E2E, so pin it to the family build's value.
delete process.env.EXPO_PUBLIC_E2E;
const { hash } = await createFingerprintAsync(app);
if (process.argv.includes('--fingerprint')) {
  console.log(hash);
  process.exit(0);
}

const version = JSON.parse(readFileSync(join(app, 'app.json'), 'utf8')).expo.version;
const major = Number(version.split('.')[0]);
console.log(`Native fingerprint: ${hash}`);

const gh = (...args) => execFileSync('gh', args, { cwd: root, encoding: 'utf8' });
const releases = JSON.parse(gh('release', 'list', '--limit', '100', '--json', 'tagName'))
  .map((r) => ({ tag: r.tagName, major: Number(/^v(\d+)\./.exec(r.tagName)?.[1]) }))
  .filter((r) => Number.isInteger(r.major))
  .sort((a, b) => b.major - a.major);
const latest = releases[0];

let mode;
if (!latest || major > latest.major) {
  mode = 'apk';
  console.log(`Version ${version} starts major ${major}: build a new APK.`);
  if (process.argv.includes('--require-ota')) {
    console.error(`No APK for major ${major} exists yet, so no device can run an OTA update.`);
    process.exit(1);
  }
} else if (major < latest.major) {
  console.error(
    `Version ${version} is behind the ${latest.tag} release. Raise it in app/app.json.`,
  );
  process.exit(1);
} else {
  const released = gh('release', 'download', latest.tag, '--pattern', FINGERPRINT_ASSET, '-O', '-');
  if (released.trim() !== hash) {
    console.error(
      `The native side changed since ${latest.tag} (fingerprint ${released.trim()} → ${hash}).\n` +
        `Installed APKs can't run this as an OTA update. Bump the major version in app/app.json.`,
    );
    process.exit(1);
  }
  mode = 'ota';
  console.log(`Version ${version} matches the ${latest.tag} APK: publish an OTA update.`);
}

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `mode=${mode}\nversion=${version}\nfingerprint=${hash}\n`,
  );
}
