import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as prettier from 'prettier';

/** Writes text formatted with the repo's Prettier config, so `format:check` passes on outputs. */
export async function writeFormatted(file: string, text: string): Promise<void> {
  const options = (await prettier.resolveConfig(file)) ?? {};
  const formatted = await prettier.format(text, { ...options, filepath: file });
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, formatted, 'utf8');
}
