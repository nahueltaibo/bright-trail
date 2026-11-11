// Uploads the content packs and their manifest to Cloudflare R2 through its S3 API.
// Usage: npm run content:publish [-- --dry-run]. Needs the `aws` CLI and the R2_* env vars.
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { parseContentBundle } from '@bright-trail/shared';
import { planUploads, publish, readR2Config, type R2Config, type Upload } from './publish';
import { splitBundle } from './split';
import { packsDir } from './write-packs';

const run = promisify(execFile);
const dryRun = process.argv.includes('--dry-run');

// Split in memory so the upload always matches bundle.json, even if the packs folder is stale.
const bundle = parseContentBundle(
  JSON.parse(await readFile(join(packsDir, '..', 'bundle.json'), 'utf8')),
);
const { manifest, files } = splitBundle(bundle);
const uploads = planUploads(files);
console.log(`Content ${manifest.version}, core ${manifest.coreHash.slice(0, 12)}:`);

let config: R2Config | null;
try {
  config = readR2Config(process.env);
} catch (error) {
  console.error((error as Error).message);
  process.exit(1);
}

if (dryRun || !config) {
  for (const u of uploads) console.log(`  ${u.key} (${Buffer.byteLength(u.body)} bytes)`);
  if (!config && !dryRun) {
    // A GitHub Actions annotation, so a skipped publish shows on the run page.
    console.log('::warning::R2_* settings are unset. Content packs were not published.');
  }
  process.exit(0);
}

const r2 = config;
const tmp = await mkdtemp(join(tmpdir(), 'bright-trail-packs-'));
const awsEnv = {
  ...process.env,
  AWS_ACCESS_KEY_ID: r2.accessKeyId,
  AWS_SECRET_ACCESS_KEY: r2.secretAccessKey,
  AWS_DEFAULT_REGION: 'auto',
};

async function put(upload: Upload) {
  const file = join(tmp, upload.key.replaceAll('/', '_'));
  await writeFile(file, upload.body, 'utf8');
  console.log(`  put ${upload.key}`);
  await run(
    'aws',
    [
      's3api',
      'put-object',
      '--endpoint-url',
      `https://${r2.accountId}.r2.cloudflarestorage.com`,
      '--bucket',
      r2.bucket,
      '--key',
      upload.key,
      '--body',
      file,
      '--content-type',
      'application/json',
      '--cache-control',
      upload.cacheControl,
    ],
    { env: awsEnv },
  );
}

try {
  await publish(uploads, put);
  console.log(`Published ${uploads.length} files to R2 bucket ${r2.bucket}.`);
} catch (error) {
  console.error(`Publish failed: ${(error as Error).message}`);
  process.exitCode = 1;
} finally {
  await rm(tmp, { recursive: true, force: true });
}
