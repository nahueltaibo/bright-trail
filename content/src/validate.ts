import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { checkBundle } from './check-bundle';

const path = process.argv[2];
// npm runs workspace scripts in content/, so resolve from where the user ran npm.
const fullPath = path && resolve(process.env.INIT_CWD ?? process.cwd(), path);
const data: unknown = fullPath ? JSON.parse(await readFile(fullPath, 'utf8')) : sample;
const result = checkBundle(data);

if (result.ok) {
  console.log(result.summary);
} else {
  console.error(`${path ?? 'sample bundle'} failed validation:`);
  for (const problem of result.problems) console.error(`  ${problem}`);
  process.exitCode = 1;
}
