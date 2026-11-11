import { readdir, readFile } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ContentBundleSchema } from '@bright-trail/shared';
import { describe, expect, it, vi } from 'vitest';
import bundleJson from '../../out/bundle.json';
import { sampleLines, type SampleLine } from './lines';
import { buildPage } from './page';
import { availableProviders, PROVIDERS, type Fetch } from './providers';
import { renderVoices } from './render';

const bundle = ContentBundleSchema.parse(bundleJson);

describe('sampleLines', () => {
  const lines = sampleLines(bundle);
  const byId = Object.fromEntries(lines.map((l) => [l.id, l]));

  it('picks 12 lines from the bundle', () => {
    expect(lines).toHaveLength(12);
    expect(new Set(lines.map((l) => l.id)).size).toBe(12);
  });

  it('covers the story, counting, math, and feedback lines', () => {
    expect(byId['story-pip'].written).toMatch(/\bPip\b/);
    expect(byId['story-long'].written.length).toBeGreaterThan(150);
    expect(byId.counting.written).toMatch(/1, 2, 3/);
    expect(byId.praise.written).toBe('Yes! Great job!');
    expect(byId['try-again'].written).toMatch(/^Good try! /);
    expect(byId.food.written).toMatch(/brownies|granola/);
  });

  it('reads math through toSpeech', () => {
    expect(byId.sum.spoken).toMatch(/plus .* equals/);
    expect(byId.fraction.spoken).toContain('three fourths');
    expect(byId.decimal.spoken).toMatch(/zero point/);
    expect(byId.percent.spoken).toContain('percent');
    for (const line of lines) expect(line.spoken).not.toMatch(/\d/);
  });

  it('throws when the bundle lacks a line', () => {
    expect(() => sampleLines({ ...bundle, nuggets: [] })).toThrow(/story-pip/);
  });
});

describe('availableProviders', () => {
  it('skips a provider with a missing or blank key and names the key', () => {
    const { ready, skipped } = availableProviders({
      OPENAI_API_KEY: 'sk',
      AZURE_SPEECH_KEY: 'k',
      AZURE_SPEECH_REGION: ' ',
    });
    expect(ready.map((p) => p.id)).toEqual(['openai']);
    expect(skipped.find((s) => s.provider.id === 'azure')?.missing).toEqual([
      'AZURE_SPEECH_REGION',
    ]);
    expect(skipped.map((s) => s.provider.id)).toEqual(['google', 'azure', 'elevenlabs']);
  });
});

describe('providers', () => {
  const mp3 = new Uint8Array([1, 2, 3]);
  const env = {
    GOOGLE_TTS_API_KEY: 'g',
    AZURE_SPEECH_KEY: 'a',
    AZURE_SPEECH_REGION: 'canadacentral',
    ELEVENLABS_API_KEY: 'e',
    OPENAI_API_KEY: 'o',
  };

  it.each(PROVIDERS.map((p) => [p.id, p] as const))(
    '%s posts the text and returns audio',
    async (id, p) => {
      const fetchFn = vi.fn<Fetch>(async () =>
        id === 'google'
          ? Response.json({ audioContent: Buffer.from(mp3).toString('base64') })
          : new Response(mp3),
      );
      const voice = p.voices(env)[0];
      expect(await p.synthesize('A & B <3', voice, env, fetchFn)).toEqual(mp3);
      const body = String(fetchFn.mock.calls[0][1]?.body);
      expect(body).toContain(id === 'azure' ? 'A &#38; B &#60;3' : 'A & B <3');
    },
  );

  it('asks OpenAI for a slow, warm delivery', async () => {
    const fetchFn = vi.fn<Fetch>(async () => new Response(mp3));
    const openai = PROVIDERS.find((p) => p.id === 'openai')!;
    await openai.synthesize('Hi', openai.voices(env)[0], env, fetchFn);
    const body = JSON.parse(String(fetchFn.mock.calls[0][1]?.body));
    expect(body).toMatchObject({ model: 'gpt-4o-mini-tts', voice: 'coral' });
    expect(body.instructions).toMatch(/slow.*6-year-old/i);
  });

  it('throws with the status and body on an error', async () => {
    const fetchFn: Fetch = async () => new Response('bad key', { status: 401 });
    const p = PROVIDERS[3];
    await expect(p.synthesize('Hi', p.voices(env)[0], env, fetchFn)).rejects.toThrow(
      /401: bad key/,
    );
  });
});

describe('renderVoices', () => {
  const lines: SampleLine[] = [
    { id: 'one', label: 'One', written: '1', spoken: 'one' },
    { id: 'two', label: 'Two', written: '2', spoken: 'two' },
  ];

  it('renders each line per voice, keeps clips on rerun, and lists skipped providers', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voices-'));
    const fetchFn = vi.fn<Fetch>(async () => new Response(new Uint8Array([9])));
    const env = { OPENAI_API_KEY: 'o' };

    const first = await renderVoices({ lines, env, outDir, fetchFn });
    expect(first).toMatchObject({ rendered: 4, cached: 0, failed: [] });
    expect(first.skipped).toHaveLength(3);
    expect(first.skipped[0]).toMatch(/Google.*GOOGLE_TTS_API_KEY/);
    expect(await readdir(join(outDir, 'clips'))).toHaveLength(4);

    const second = await renderVoices({ lines, env, outDir, fetchFn });
    expect(second).toMatchObject({ rendered: 0, cached: 4 });
    expect(fetchFn).toHaveBeenCalledTimes(4);

    const page = await readFile(second.page, 'utf8');
    expect(page).toContain('OpenAI Coral');
    expect(page).toContain('no GOOGLE_TTS_API_KEY in .env');
  });

  it('records a failed clip and keeps going', async () => {
    const outDir = await mkdtemp(join(tmpdir(), 'voices-'));
    let calls = 0;
    const fetchFn: Fetch = async () =>
      ++calls === 1 ? new Response('busy', { status: 429 }) : new Response(new Uint8Array([9]));
    const result = await renderVoices({ lines, env: { OPENAI_API_KEY: 'o' }, outDir, fetchFn });
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatch(/OpenAI Coral, one: OpenAI 429/);
    expect(result.rendered).toBe(3);
  });
});

describe('buildPage', () => {
  it('embeds the data without letting a line close the script', () => {
    const html = buildPage({
      lines: [{ id: 'x', label: 'X', written: '</script><b>', spoken: 'x' }],
      voices: [{ id: 'openai:coral', name: 'OpenAI Coral' }],
      clips: { x: { 'openai:coral': 'clips/x.mp3' } },
      skipped: ['Azure: no <key>'],
    });
    expect(html.match(/<\/script>/g)).toHaveLength(2);
    expect(html).toContain('<li>Azure: no &lt;key&gt;</li>');
    expect(html).toContain('id="reveal"');
  });
});
