import { createHash } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SampleLine } from './lines';
import { buildPage, type PageData } from './page';
import { availableProviders, DELIVERY, type Env, type Fetch, type Provider } from './providers';

export interface RenderResult {
  page: string;
  rendered: number;
  cached: number;
  failed: string[];
  skipped: string[];
}

const exists = (file: string) =>
  access(file).then(
    () => true,
    () => false,
  );

/**
 * Renders every line with every voice of each provider that has its keys, then writes
 * `index.html`. A clip already on disk is kept, so reruns only pay for new lines or voices.
 */
export async function renderVoices(options: {
  lines: SampleLine[];
  env: Env;
  outDir: string;
  providers?: Provider[];
  fetchFn?: Fetch;
  log?: (message: string) => void;
}): Promise<RenderResult> {
  const { lines, env, outDir, fetchFn = fetch, log = () => {} } = options;
  const { ready, skipped } = availableProviders(env, options.providers);
  const skippedText = skipped.map(
    ({ provider, missing }) => `${provider.name}: no ${missing.join(' or ')} in .env`,
  );
  for (const s of skippedText) log(`Skipping ${s}`);

  await mkdir(join(outDir, 'clips'), { recursive: true });
  const data: PageData = { lines, voices: [], clips: {}, skipped: skippedText };
  const result: RenderResult = {
    page: '',
    rendered: 0,
    cached: 0,
    failed: [],
    skipped: skippedText,
  };

  for (const provider of ready) {
    for (const voice of provider.voices(env)) {
      data.voices.push({ id: voice.id, name: voice.name });
      for (const line of lines) {
        // The hash covers what changes the audio, so an edited line or prompt renders again.
        const hash = createHash('sha256')
          .update(JSON.stringify([voice.id, line.spoken, DELIVERY]))
          .digest('hex')
          .slice(0, 12);
        const file = `clips/${line.id}-${voice.id.replace(/[^\w-]+/g, '_')}-${hash}.mp3`;
        const path = join(outDir, file);
        if (await exists(path)) {
          result.cached++;
        } else {
          try {
            await writeFile(path, await provider.synthesize(line.spoken, voice, env, fetchFn));
            result.rendered++;
            log(`${voice.name}: ${line.id}`);
          } catch (error) {
            const message = `${voice.name}, ${line.id}: ${(error as Error).message}`;
            result.failed.push(message);
            log(`Failed ${message}`);
            continue;
          }
        }
        (data.clips[line.id] ??= {})[voice.id] = file;
      }
    }
  }

  result.page = join(outDir, 'index.html');
  await writeFile(result.page, buildPage(data), 'utf8');
  return result;
}
