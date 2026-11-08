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
import { homedir } from 'node:os';
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

// Family devices only accept upgrades signed with the same key, so the family build refuses to
// fall back to the debug key. The e2e build keeps the template's debug key.
function releaseSigning() {
  const file =
    process.env.BRIGHT_TRAIL_SIGNING ?? join(homedir(), '.bright-trail', 'release.properties');
  if (!existsSync(file)) {
    console.error(`No release signing properties at ${file}. See docs/install-android.md.`);
    process.exit(1);
  }
  const props = Object.fromEntries(
    readFileSync(file, 'utf8')
      .split(/\r?\n/)
      .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
      .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1)]),
  );
  for (const key of ['storeFile', 'storePassword', 'keyAlias', 'keyPassword']) {
    if (!props[key]) {
      console.error(`${file} is missing ${key}.`);
      process.exit(1);
    }
  }
  if (!existsSync(props.storeFile)) {
    console.error(`Release keystore not found at ${props.storeFile}.`);
    process.exit(1);
  }
  return props;
}

const signing = variant === 'family' ? releaseSigning() : null;

// Prebuild repoints the `android` and `ios` scripts at native builds. Keep them on Expo Go.
const pkgPath = join(app, 'package.json');
const pkg = readFileSync(pkgPath, 'utf8');
run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], app);
writeFileSync(pkgPath, pkg);

// Prebuild keeps an existing build.gradle, so set the signing both ways on every build.
// Gradle reads the secrets from env vars, so they never land in android/ or the build log.
const gradlePath = join(android, 'app', 'build.gradle');
const releaseBlock = `
        release {
            storeFile file(System.getenv('BT_STORE_FILE'))
            storePassword System.getenv('BT_STORE_PASSWORD')
            keyAlias System.getenv('BT_KEY_ALIAS')
            keyPassword System.getenv('BT_KEY_PASSWORD')
        }`;
const releaseType = /(release \{[^}]*?signingConfig signingConfigs\.)(debug|release)/;
let gradle = readFileSync(gradlePath, 'utf8').replace(releaseBlock, '');
if (!releaseType.test(gradle)) {
  console.error(`Couldn't find the release signingConfig in ${gradlePath}. The template changed.`);
  process.exit(1);
}
if (signing) {
  env.BT_STORE_FILE = signing.storeFile;
  env.BT_STORE_PASSWORD = signing.storePassword;
  env.BT_KEY_ALIAS = signing.keyAlias;
  env.BT_KEY_PASSWORD = signing.keyPassword;
  gradle = gradle.replace('signingConfigs {', `signingConfigs {${releaseBlock}`);
}
writeFileSync(gradlePath, gradle.replace(releaseType, `$1${signing ? 'release' : 'debug'}`));

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
console.log(`Signed with the ${signing ? `release key in ${signing.storeFile}` : 'debug key'}.`);
