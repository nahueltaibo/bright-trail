import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { getPlatformProxy, type PlatformProxy } from 'wrangler';
import worker from '../src';
import type { Env } from '../src/env';

const root = fileURLToPath(new URL('..', import.meta.url));

export const TOKEN = 'test-admin-token';

export const item = {
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

export function sampleReport(overrides: Record<string, unknown> = {}) {
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

export const png = (size = 64) => {
  const bytes = new Uint8Array(size);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return bytes;
};

/** Real D1 and R2 from Miniflare, with every migration applied and the admin token set. */
export async function startWorker() {
  const proxy: PlatformProxy<Env> = await getPlatformProxy<Env>({
    configPath: `${root}/wrangler.jsonc`,
    persist: false,
  });
  const files = (await readdir(`${root}/migrations`)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const sql = await readFile(`${root}/migrations/${file}`, 'utf8');
    const statements = sql
      .replace(/--.*$/gm, '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) await proxy.env.DB.prepare(statement).run();
  }
  const env: Env = { DB: proxy.env.DB, CAPTURES: proxy.env.CAPTURES, FEEDBACK_ADMIN_TOKEN: TOKEN };
  return {
    env,
    dispose: () => proxy.dispose(),
    /** Calls the Worker's fetch handler directly. */
    call: (path: string, init: RequestInit = {}) =>
      worker.fetch(new Request(`http://localhost${path}`, init), env),
    /** Empties every table and the bucket between tests. */
    reset: async () => {
      await env.DB.batch(
        ['reports', 'intake_hits', 'daily_usage'].map((t) => env.DB.prepare(`DELETE FROM ${t}`)),
      );
      const { objects } = await env.CAPTURES.list();
      if (objects.length > 0) await env.CAPTURES.delete(objects.map((o) => o.key));
    },
  };
}

export type TestWorker = Awaited<ReturnType<typeof startWorker>>;

/** Stores a report straight in D1, with its capture in R2 when `capture` is set. */
export async function insertReport(
  env: Env,
  {
    receivedAt = new Date().toISOString(),
    status = 'new',
    issueClosedAt = null,
    capture = false,
    report = sampleReport({ hasCapture: capture }),
  }: {
    receivedAt?: string;
    status?: string;
    issueClosedAt?: string | null;
    capture?: boolean;
    report?: ReturnType<typeof sampleReport>;
  } = {},
) {
  const captureKey = capture ? `captures/${report.id}.png` : null;
  if (captureKey) {
    await env.CAPTURES.put(captureKey, png(100), { httpMetadata: { contentType: 'image/png' } });
  }
  await env.DB.prepare(
    `INSERT INTO reports
       (id, created_at, received_at, status, content_kind, content_id, skill_id, capture_key,
        capture_bytes, issue_closed_at, report)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      report.id,
      report.createdAt,
      receivedAt,
      status,
      (report.target as { contentKind: string }).contentKind,
      (report.target as { contentId: string }).contentId,
      report.skillId,
      captureKey,
      capture ? 100 : 0,
      issueClosedAt,
      JSON.stringify(report),
    )
    .run();
  return { id: report.id, report, captureKey };
}
