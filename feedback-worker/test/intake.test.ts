import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import worker from '../src';
import { LIMITS, type Env } from '../src/intake';

const root = fileURLToPath(new URL('..', import.meta.url));

const item = {
  id: 'k-more-less-same-keypad-3',
  skillId: 'k-more-less-same',
  type: 'keypad',
  difficulty: 2,
  narration: 'Which number is less, 7 or 2? Type the smaller number.',
  prompt: '7 or 2: less?',
  why: '2 comes before 7 when we count. So 2 is less than 7.',
  game: { kind: 'compare', ask: 'least', values: ['7', '2'] },
  answer: 2,
};

function sampleReport(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    createdAt: '2026-11-16T14:30:00Z',
    comment: 'The towers are the wrong height.',
    target: { contentKind: 'item', contentId: item.id, cardIndex: null },
    item,
    skillId: item.skillId,
    phase: 'check',
    content: { bundleVersion: '2026.11.16-1', coreHash: 'a'.repeat(64), contentSchemaVersion: 5 },
    app: { appVersion: '3.0.0', runtimeVersion: '3', updateId: null },
    device: { platform: 'android', osVersion: '14', model: 'Samsung SM-X200' },
    screen: { width: 800, height: 1280, scale: 1.5, fontScale: 1 },
    settings: { readingMode: false, dyslexicFont: true },
    hasCapture: false,
    ...overrides,
  };
}

const png = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
};

// Real D1 and R2 from Miniflare, with the Worker's handler called directly.
let proxy: PlatformProxy<Env>;

/** Posts a multipart report the way the app does. A string report goes up as is. */
async function post(
  report: object | string,
  { capture, ip = '203.0.113.7' }: { capture?: Uint8Array; ip?: string } = {},
) {
  const form = new FormData();
  form.set('report', typeof report === 'string' ? report : JSON.stringify(report));
  if (capture) form.set('capture', new Blob([capture as BlobPart]), 'capture');
  // Serialized here so Miniflare gets plain bytes and the multipart boundary.
  const encoded = new Response(form);
  return send({
    body: new Uint8Array(await encoded.arrayBuffer()),
    headers: { 'Content-Type': encoded.headers.get('Content-Type')!, 'CF-Connecting-IP': ip },
  });
}

function call(path: string, init: RequestInit = {}) {
  return worker.fetch(new Request(`http://localhost${path}`, init), proxy.env);
}

async function send(init: {
  method?: string;
  body?: Uint8Array<ArrayBuffer>;
  headers?: Record<string, string>;
}) {
  const res = await call('/v1/reports', { method: 'POST', ...init });
  return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

const db = async () => proxy.env.DB;
const today = () => new Date().toISOString().slice(0, 10);

beforeAll(async () => {
  proxy = await getPlatformProxy<Env>({ configPath: `${root}/wrangler.jsonc`, persist: false });
  const sql = await readFile(`${root}/migrations/0001_reports.sql`, 'utf8');
  const statements = sql
    .replace(/--.*$/gm, '')
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const statement of statements) await proxy.env.DB.prepare(statement).run();
}, 60_000);

afterAll(async () => {
  await proxy?.dispose();
});

beforeEach(async () => {
  const database = await db();
  await database.batch(
    ['reports', 'intake_hits', 'daily_usage'].map((t) => database.prepare(`DELETE FROM ${t}`)),
  );
});

describe('POST /v1/reports', () => {
  it('stores a report and its capture, and counts them for the day', async () => {
    const report = sampleReport({ hasCapture: true });
    const res = await post(report, { capture: png(100) });

    expect(res).toEqual({ status: 201, body: { id: report.id } });
    const database = await db();
    const row = await database
      .prepare('SELECT status, content_id, capture_key, report FROM reports WHERE id = ?')
      .bind(report.id)
      .first<{ status: string; content_id: string; capture_key: string; report: string }>();
    expect(row).toMatchObject({
      status: 'new',
      content_id: item.id,
      capture_key: `captures/${report.id}.png`,
    });
    expect(JSON.parse(row!.report)).toEqual(report);
    const object = await proxy.env.CAPTURES.get(`captures/${report.id}.png`);
    expect(object?.size).toBe(100);
    expect(object?.httpMetadata?.contentType).toBe('image/png');
    const usage = await database.prepare('SELECT * FROM daily_usage').first();
    expect(usage).toEqual({ day: today(), reports: 1, capture_bytes: 100 });
  });

  it('accepts a JPEG capture', async () => {
    const report = sampleReport({ hasCapture: true });
    const res = await post(report, { capture: new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2]) });
    expect(res.status).toBe(201);
    expect(await proxy.env.CAPTURES.head(`captures/${report.id}.jpg`)).not.toBe(null);
  });

  it('answers 200 to a retried id and keeps one report', async () => {
    const report = sampleReport();
    expect((await post(report)).status).toBe(201);

    expect(await post(report)).toEqual({ status: 200, body: { id: report.id, duplicate: true } });
    const database = await db();
    const count = await database.prepare('SELECT COUNT(*) AS n FROM reports').first('n');
    expect(count).toBe(1);
    expect(await database.prepare('SELECT reports FROM daily_usage').first('reports')).toBe(1);
  });

  it('answers 429 to the 31st report from one IP in an hour', async () => {
    for (let i = 0; i < LIMITS.reportsPerIpPerHour; i++) {
      expect((await post(sampleReport())).status).toBe(201);
    }

    expect((await post(sampleReport())).status).toBe(429);
    expect((await post(sampleReport(), { ip: '198.51.100.2' })).status).toBe(201);
  });

  it('keeps no raw IP and forgets hits older than an hour', async () => {
    const database = await db();
    const hourAgo = Date.now() - 60 * 60 * 1000 - 1;
    await database.batch(
      Array.from({ length: LIMITS.reportsPerIpPerHour }, () =>
        database.prepare('INSERT INTO intake_hits (ip_hash, at) VALUES (?, ?)').bind('x', hourAgo),
      ),
    );

    expect((await post(sampleReport())).status).toBe(201);
    const hits = await database
      .prepare('SELECT ip_hash FROM intake_hits')
      .all<{ ip_hash: string }>();
    expect(hits.results).toHaveLength(1);
    expect(hits.results[0].ip_hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('answers 413 to an oversize report or capture', async () => {
    const big = sampleReport({ comment: null, padding: 'x'.repeat(LIMITS.reportBytes) });
    expect((await post(big)).status).toBe(413);

    const capture = png(LIMITS.captureBytes + 1);
    expect((await post(sampleReport({ hasCapture: true }), { capture })).status).toBe(413);
  });

  it('answers 413 to a body past the limit before reading it as a form', async () => {
    const body = new Uint8Array(LIMITS.reportBytes + LIMITS.captureBytes + 32 * 1024);
    const res = await send({
      body,
      headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
    });
    expect(res.status).toBe(413);
  });

  it('answers 415 to a capture that is not PNG or JPEG, or a body that is not multipart', async () => {
    const gif = new TextEncoder().encode('GIF89a......');
    expect((await post(sampleReport({ hasCapture: true }), { capture: gif })).status).toBe(415);

    const res = await send({
      body: new TextEncoder().encode(JSON.stringify(sampleReport())),
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.status).toBe(415);
  });

  it('answers 503 once the day has 5,000 reports, and still 200 to a retried id', async () => {
    const stored = sampleReport();
    expect((await post(stored)).status).toBe(201);
    const database = await db();
    await database
      .prepare('UPDATE daily_usage SET reports = ? WHERE day = ?')
      .bind(LIMITS.reportsPerDay, today())
      .run();

    const res = await post(sampleReport());
    expect(res.status).toBe(503);
    expect((await post(stored)).status).toBe(200);
  });

  it('answers 503 when a capture would pass the daily capture bytes', async () => {
    const database = await db();
    await database
      .prepare('INSERT INTO daily_usage (day, reports, capture_bytes) VALUES (?, 1, ?)')
      .bind(today(), LIMITS.captureBytesPerDay - 50)
      .run();

    expect((await post(sampleReport({ hasCapture: true }), { capture: png(100) })).status).toBe(
      503,
    );
    expect((await post(sampleReport())).status).toBe(201);
  });

  it('answers 400 to a report the schema rejects', async () => {
    const unknown = await post(sampleReport({ childId: 'c1' }));
    expect(unknown.status).toBe(400);
    expect(unknown.body.issues).toBeDefined();

    expect((await post('{not json')).status).toBe(400);
    expect((await post(sampleReport({ hasCapture: true }))).status).toBe(400);
    expect((await post(sampleReport(), { capture: png() })).status).toBe(400);
    const database = await db();
    expect(await database.prepare('SELECT COUNT(*) AS n FROM reports').first('n')).toBe(0);
  });

  it('answers 405 to other methods and 404 to other paths', async () => {
    expect((await call('/v1/reports')).status).toBe(405);
    expect((await call('/admin/reports')).status).toBe(404);
  });
});
