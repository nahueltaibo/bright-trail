// Serves content/out/packs/ the way the content host does, for dev and e2e builds.
// Usage: node scripts/serve-packs.mjs [--port <n>]   (default 8090)
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, join, normalize, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'content', 'out', 'packs');
export const PACKS_PORT = 8090;

/** Starts the server and resolves once it listens. Close it with `server.close()`. */
export function servePacks(port = PACKS_PORT) {
  const server = createServer(async (req, res) => {
    // The web build fetches from another origin than Metro's.
    res.setHeader('Access-Control-Allow-Origin', '*');
    const path = normalize(
      join(packsDir, decodeURIComponent(new URL(req.url, 'http://x').pathname)),
    );
    if (req.method !== 'GET' || !path.startsWith(packsDir + sep) || !path.endsWith('.json')) {
      res.writeHead(404).end();
      return;
    }
    try {
      const body = await readFile(path);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const at = process.argv.indexOf('--port');
  const port = at >= 0 ? Number(process.argv[at + 1]) : PACKS_PORT;
  await servePacks(port);
  console.log(`Serving ${packsDir} at http://localhost:${port}`);
}
