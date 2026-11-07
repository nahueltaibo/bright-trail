// Builds a standalone release APK with the JS and content bundled. No Metro needed at run time.
// Usage: node scripts/build-android.mjs --e2e | --family
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');
const android = join(app, 'android');
const windows = process.platform === 'win32';

const variant = process.argv.includes('--e2e')
  ? 'e2e'
  : process.argv.includes('--family')
    ? 'family'
    : null;
if (!variant) {
  console.error('Pass --e2e or --family.');
  process.exit(1);
}

const env = { ...process.env, NODE_ENV: 'production' };
// The e2e build turns on the dev-only learning preview. The family build must not inherit it.
if (variant === 'e2e') env.EXPO_PUBLIC_E2E = '1';
else delete env.EXPO_PUBLIC_E2E;

function compareVersions(a, b) {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

function newestCmake() {
  const base = join(process.env.ANDROID_HOME ?? '', 'cmake');
  if (!process.env.ANDROID_HOME || !existsSync(base)) return null;
  const versions = readdirSync(base).sort(compareVersions);
  const version = versions.at(-1);
  return version ? { version, dir: join(base, version) } : null;
}

function run(command, args, cwd) {
  console.log(`> ${command} ${args.join(' ')}`);
  // .bat and .cmd files only start through a shell on Windows.
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: windows });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

// Prebuild repoints the `android` and `ios` scripts at native builds. Keep them on Expo Go.
const pkgPath = join(app, 'package.json');
const pkg = readFileSync(pkgPath, 'utf8');
run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], app);
writeFileSync(pkgPath, pkg);

// The default CMake 3.22 ships ninja 1.10, which can't create the 250+ character object
// folders codegen needs on Windows. Ninja 1.12 (CMake 3.31+) can, with long paths enabled.
if (windows) {
  const cmake = newestCmake();
  if (!cmake || compareVersions(cmake.version, '3.31') < 0) {
    console.error(
      'Windows builds need CMake 3.31 or newer in the Android SDK: sdkmanager "cmake;3.31.6"',
    );
    process.exit(1);
  }
  const dir = cmake.dir.replaceAll('\\', '\\\\').replace(':', '\\:');
  writeFileSync(join(android, 'local.properties'), `cmake.dir=${dir}\n`);
}

// Emulators are x86_64 and current phones arm64. Skipping 32-bit ABIs roughly halves the build.
const abis = process.env.E2E_ABIS ?? 'arm64-v8a,x86_64';
run(
  join(android, windows ? 'gradlew.bat' : 'gradlew'),
  ['assembleRelease', `-PreactNativeArchitectures=${abis}`],
  android,
);

const apk = join(android, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');

const appVersion = JSON.parse(readFileSync(join(app, 'app.json'), 'utf8')).expo.version;
const bundleVersion = JSON.parse(
  readFileSync(join(root, 'content', 'out', 'bundle.json'), 'utf8'),
).version;
const out =
  variant === 'e2e'
    ? join(root, 'e2e', 'output', 'bright-trail-e2e.apk')
    : join(root, 'dist', `bright-trail-${appVersion}-${bundleVersion}.apk`);
mkdirSync(dirname(out), { recursive: true });
copyFileSync(apk, out);
console.log(`APK: ${out} (${(statSync(out).size / 1024 / 1024).toFixed(1)} MB)`);
