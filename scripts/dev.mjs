// Starts the Expo dev server, stopping any server already on its port first.
// Usage: npm run dev -- [web|go|android|ios] [--clear] [--port <n>] [extra expo start args]
import { spawnSync, spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = join(root, 'app');
const windows = process.platform === 'win32';

const modes = { web: ['--web'], go: [], android: ['--android'], ios: ['--ios'] };
const args = process.argv.slice(2);
const mode = args[0] in modes ? args.shift() : 'web';
const portAt = args.indexOf('--port');
const port = portAt >= 0 ? Number(args[portAt + 1]) : 8081;
if (portAt < 0) args.push('--port', String(port));

function listeningPids(p) {
  if (windows) {
    // Match on owner, not state: some Windows setups report Metro's listener as "Closed".
    const script = `Get-NetTCPConnection -LocalPort ${p} -ErrorAction SilentlyContinue | Where-Object OwningProcess -gt 4 | Select-Object -ExpandProperty OwningProcess -Unique`;
    const out = spawnSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8' });
    return (out.stdout ?? '').split(/\s+/).filter(Boolean);
  }
  const out = spawnSync('lsof', ['-ti', `tcp:${p}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).stdout;
  return (out ?? '').split(/\s+/).filter(Boolean);
}

const pids = listeningPids(port);
for (const pid of pids) {
  console.log(`Stopping process ${pid} on port ${port}`);
  // /T also ends the node children that `npx expo start` spawned.
  if (windows) spawnSync('taskkill', ['/PID', pid, '/T', '/F'], { stdio: 'ignore' });
  else process.kill(Number(pid), 'SIGTERM');
}
// The OS can hold the port for a few seconds after the process dies.
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
for (let i = 0; pids.length && i < 20 && listeningPids(port).length; i++) sleep(500);
if (pids.length && listeningPids(port).length) {
  console.error(`Port ${port} is still in use. Stop that process and retry.`);
  process.exit(1);
}

// npm stamps node_modules/.package-lock.json on install. Older than the lockfile means
// a branch added deps that this checkout never installed.
const stamp = join(root, 'node_modules', '.package-lock.json');
const lock = join(root, 'package-lock.json');
if (!existsSync(stamp) || statSync(lock).mtimeMs > statSync(stamp).mtimeMs) {
  console.log('> npm install  (dependencies changed)');
  if (spawnSync('npm install', { cwd: root, stdio: 'inherit', shell: true }).status !== 0) {
    process.exit(1);
  }
}

// One command string: Node deprecates passing an args array together with `shell`.
const command = ['npx', 'expo', 'start', ...modes[mode], ...args].join(' ');
console.log(`> ${command}  (in app/)`);
const child = spawn(command, { cwd: app, stdio: 'inherit', shell: true });
child.on('exit', (code) => process.exit(code ?? 0));
