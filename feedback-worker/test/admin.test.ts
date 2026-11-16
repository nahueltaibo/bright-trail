import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { LINK_TTL_SECONDS, signCaptureLink } from '../src/captures';
import { insertReport, item, sampleReport, startWorker, TOKEN, type TestWorker } from './helpers';

let worker: TestWorker;

const auth = { Authorization: `Bearer ${TOKEN}` };

/** The fields these tests read from any admin response. */
interface Body {
  [key: string]: unknown;
  reports: { id: string; hasCapture: boolean }[];
  next: string | null;
  status: string;
  url: string;
  expiresAt: string;
}

async function admin(path: string, init: RequestInit = {}) {
  const res = await worker.call(path, { ...init, headers: { ...auth, ...init.headers } });
  return { status: res.status, body: (await res.json()) as Body };
}

const patch = (path: string, body: unknown) =>
  admin(path, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const ids = (body: Body) => body.reports.map((r) => r.id);

beforeAll(async () => {
  worker = await startWorker();
}, 60_000);

afterAll(async () => {
  await worker?.dispose();
});

beforeEach(async () => {
  await worker.reset();
});

describe('admin auth', () => {
  it('answers 401 without a token, with a wrong one, or when the secret is unset', async () => {
    const missing = await worker.call('/admin/reports');
    expect(missing.status).toBe(401);
    expect(missing.headers.get('WWW-Authenticate')).toBe('Bearer');

    const wrong = await worker.call('/admin/reports', {
      headers: { Authorization: `Bearer ${TOKEN}x` },
    });
    expect(wrong.status).toBe(401);
    const basic = await worker.call('/admin/reports', { headers: { Authorization: TOKEN } });
    expect(basic.status).toBe(401);

    const { default: handler } = await import('../src');
    const unset = await handler.fetch(
      new Request('http://localhost/admin/reports', { headers: auth }),
      { ...worker.env, FEEDBACK_ADMIN_TOKEN: '' },
    );
    expect(unset.status).toBe(401);
  });

  it('matches the Bearer scheme in any case', async () => {
    const res = await worker.call('/admin/reports', {
      headers: { Authorization: `bearer ${TOKEN}` },
    });
    expect(res.status).toBe(200);
  });

  it('answers 401 to a PATCH or capture without the token, and changes nothing', async () => {
    const { id } = await insertReport(worker.env, { capture: true });
    const res = await worker.call('/admin/reports', {
      method: 'PATCH',
      body: JSON.stringify({ ids: [id], status: 'rejected' }),
    });
    expect(res.status).toBe(401);
    expect((await worker.call(`/admin/captures/${id}`)).status).toBe(401);
    expect((await admin(`/admin/reports/${id}`)).body.status).toBe('new');
  });

  it('answers 404 to unknown admin paths and 405 with Allow to other methods', async () => {
    expect((await admin('/admin/nope')).status).toBe(404);
    const res = await worker.call('/admin/reports', { method: 'DELETE', headers: auth });
    expect(res.status).toBe(405);
    expect(res.headers.get('Allow')).toBe('GET, PATCH');
  });
});

describe('GET /admin/reports', () => {
  it('lists reports newest first, with their triage fields', async () => {
    const older = await insertReport(worker.env, { receivedAt: '2026-11-01T10:00:00.000Z' });
    const newer = await insertReport(worker.env, {
      receivedAt: '2026-11-02T10:00:00.000Z',
      capture: true,
    });

    const { status, body } = await admin('/admin/reports');
    expect(status).toBe(200);
    expect(ids(body)).toEqual([newer.id, older.id]);
    expect(body.next).toBe(null);
    expect(body.reports[0]).toEqual({
      ...newer.report,
      status: 'new',
      groupKey: null,
      issueNumber: null,
      issueClosedAt: null,
      receivedAt: '2026-11-02T10:00:00.000Z',
    });
    expect(body.reports[0].hasCapture).toBe(true);
  });

  it('filters by status, item, skill, and date', async () => {
    const filed = await insertReport(worker.env, {
      status: 'filed',
      receivedAt: '2026-11-01T10:00:00.000Z',
    });
    const other = await insertReport(worker.env, {
      receivedAt: '2026-11-05T10:00:00.000Z',
      report: sampleReport({
        target: { contentKind: 'item', contentId: 'g1-other-1', cardIndex: null },
        item: { ...item, id: 'g1-other-1', skillId: 'g1-other' },
        skillId: 'g1-other',
      }),
    });
    const plain = await insertReport(worker.env, { receivedAt: '2026-11-10T10:00:00.000Z' });

    expect(ids((await admin('/admin/reports?status=filed')).body)).toEqual([filed.id]);
    expect(ids((await admin('/admin/reports?status=new')).body)).toEqual([plain.id, other.id]);
    expect(ids((await admin('/admin/reports?contentId=g1-other-1')).body)).toEqual([other.id]);
    expect(ids((await admin(`/admin/reports?skillId=${item.skillId}`)).body)).toEqual([
      plain.id,
      filed.id,
    ]);
    expect(ids((await admin('/admin/reports?since=2026-11-05')).body)).toEqual([
      plain.id,
      other.id,
    ]);
    expect(ids((await admin('/admin/reports?until=2026-11-05T10:00:00Z')).body)).toEqual([
      filed.id,
    ]);
    const window = '/admin/reports?since=2026-11-02&until=2026-11-06T00:00:00-05:00';
    expect(ids((await admin(window)).body)).toEqual([other.id]);
  });

  it('pages with limit and the next cursor, ties included', async () => {
    const at = '2026-11-03T10:00:00.000Z';
    const inserted = [];
    for (let i = 0; i < 5; i++)
      inserted.push((await insertReport(worker.env, { receivedAt: at })).id);
    const expected = inserted.sort().reverse();

    const seen: string[] = [];
    let next: string | null = null;
    let pages = 0;
    do {
      const query: string = next ? `limit=2&cursor=${next}` : 'limit=2';
      const { body } = await admin(`/admin/reports?${query}`);
      seen.push(...ids(body));
      next = body.next;
      pages++;
    } while (next);
    expect(pages).toBe(3);
    expect(seen).toEqual(expected);
  });

  it('answers 400 to bad query values', async () => {
    for (const query of [
      'status=open',
      'limit=0',
      'limit=201',
      'since=yesterday',
      'cursor=nope',
      `cursor=${btoa(JSON.stringify({ receivedAt: 'x' }))}`,
      'color=red',
    ]) {
      expect((await admin(`/admin/reports?${query}`)).status, query).toBe(400);
    }
  });

  it('gets one report by id, or 404', async () => {
    const { id, report } = await insertReport(worker.env);
    const { status, body } = await admin(`/admin/reports/${id}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({ ...report, status: 'new' });
    expect((await admin(`/admin/reports/${crypto.randomUUID()}`)).status).toBe(404);
  });
});

describe('PATCH /admin/reports', () => {
  it('sets status, group, issue number, and close time on many reports', async () => {
    const a = await insertReport(worker.env);
    const b = await insertReport(worker.env);
    const untouched = await insertReport(worker.env);

    const res = await patch('/admin/reports', {
      ids: [a.id, b.id, crypto.randomUUID()],
      status: 'filed',
      groupKey: item.id,
      issueNumber: 140,
    });
    expect(res).toEqual({ status: 200, body: { updated: 2 } });
    for (const id of [a.id, b.id]) {
      expect((await admin(`/admin/reports/${id}`)).body).toMatchObject({
        status: 'filed',
        groupKey: item.id,
        issueNumber: 140,
        issueClosedAt: null,
      });
    }
    expect((await admin(`/admin/reports/${untouched.id}`)).body.status).toBe('new');

    await patch('/admin/reports', { ids: [a.id], issueClosedAt: '2026-11-20T09:00:00-05:00' });
    expect((await admin(`/admin/reports/${a.id}`)).body).toMatchObject({
      status: 'filed',
      issueNumber: 140,
      issueClosedAt: '2026-11-20T14:00:00.000Z',
    });
  });

  it('patches one report by id, clears fields with null, and 404s a missing id', async () => {
    const { id } = await insertReport(worker.env, { status: 'filed' });
    await patch(`/admin/reports/${id}`, { groupKey: 'g', issueNumber: 9 });

    const res = await patch(`/admin/reports/${id}`, {
      status: 'rejected',
      groupKey: null,
      issueNumber: null,
    });
    expect(res).toEqual({ status: 200, body: { updated: 1 } });
    expect((await admin(`/admin/reports/${id}`)).body).toMatchObject({
      status: 'rejected',
      groupKey: null,
      issueNumber: null,
    });
    expect((await patch(`/admin/reports/${crypto.randomUUID()}`, { status: 'new' })).status).toBe(
      404,
    );
  });

  it('answers 400 to a bad patch and changes nothing', async () => {
    const { id } = await insertReport(worker.env);
    const bad = [
      { ids: [id] },
      { ids: [], status: 'filed' },
      { ids: Array.from({ length: 201 }, () => id), status: 'filed' },
      { ids: [id], status: 'open' },
      { ids: [id], issueNumber: 1.5 },
      { ids: [id], issueClosedAt: 'last week' },
      { ids: [id], status: 'filed', childId: 'c1' },
    ];
    for (const body of bad) {
      expect((await patch('/admin/reports', body)).status, JSON.stringify(body)).toBe(400);
    }
    expect((await patch(`/admin/reports/${id}`, { ids: [id], status: 'filed' })).status).toBe(400);
    const notJson = await admin('/admin/reports', { method: 'PATCH', body: '{' });
    expect(notJson.status).toBe(400);
    expect((await admin(`/admin/reports/${id}`)).body.status).toBe('new');
  });
});

describe('captures', () => {
  it('streams a capture to the admin, and 404s a report without one', async () => {
    const { id } = await insertReport(worker.env, { capture: true });
    const res = await worker.call(`/admin/captures/${id}`, { headers: auth });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('Cache-Control')).toBe('private, no-store');
    expect((await res.arrayBuffer()).byteLength).toBe(100);

    const bare = await insertReport(worker.env);
    expect((await admin(`/admin/captures/${bare.id}`)).status).toBe(404);
    expect((await admin(`/admin/captures/${bare.id}?link=1`)).status).toBe(404);
    expect((await admin(`/admin/captures/${crypto.randomUUID()}`)).status).toBe(404);
  });

  it('signs a link that works without the token for 7 days', async () => {
    const { id } = await insertReport(worker.env, { capture: true });
    const before = Date.now();
    const { status, body } = await admin(`/admin/captures/${id}?link=1`);
    expect(status).toBe(200);
    const url = new URL(body.url);
    expect(url.origin).toBe('http://localhost');
    expect(url.pathname).toBe(`/captures/${id}`);
    const exp = Number(url.searchParams.get('exp'));
    expect(exp).toBeGreaterThanOrEqual(Math.floor(before / 1000) + LINK_TTL_SECONDS);
    expect(body.expiresAt).toBe(new Date(exp * 1000).toISOString());

    const res = await worker.call(`${url.pathname}${url.search}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect((await res.arrayBuffer()).byteLength).toBe(100);
  });

  it('refuses a link past its 7 days', async () => {
    const { id } = await insertReport(worker.env, { capture: true });
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const { url } = await signCaptureLink('http://localhost', id, TOKEN, eightDaysAgo);
    const res = await worker.call(new URL(url).pathname + new URL(url).search);
    expect(res.status).toBe(403);
  });

  it('refuses a tampered link, one for another id, or one more than 7 days out', async () => {
    const { id } = await insertReport(worker.env, { capture: true });
    const other = await insertReport(worker.env, { capture: true });
    const { url } = await signCaptureLink('http://localhost', id, TOKEN);
    const link = new URL(url);
    const exp = link.searchParams.get('exp')!;
    const sig = link.searchParams.get('sig')!;
    const open = (path: string) => worker.call(path).then((res) => res.status);

    const flipped = (sig[0] === '0' ? '1' : '0') + sig.slice(1);
    expect(await open(`/captures/${id}?exp=${exp}&sig=${flipped}`)).toBe(403);
    expect(await open(`/captures/${id}?exp=${Number(exp) + 1}&sig=${sig}`)).toBe(403);
    expect(await open(`/captures/${other.id}?exp=${exp}&sig=${sig}`)).toBe(403);
    expect(await open(`/captures/${id}?exp=${exp}`)).toBe(403);
    expect(await open(`/captures/${id}`)).toBe(403);
    for (const bad of ['1e10', '12.5', `0${exp}`]) {
      expect(await open(`/captures/${id}?exp=${bad}&sig=${sig}`), bad).toBe(403);
    }

    const later = await signCaptureLink('http://localhost', id, TOKEN, Date.now() + 60_000);
    expect(await open(new URL(later.url).pathname + new URL(later.url).search)).toBe(403);

    const wrongKey = await signCaptureLink('http://localhost', id, 'another-token');
    expect(await open(new URL(wrongKey.url).pathname + new URL(wrongKey.url).search)).toBe(403);
  });

  it('answers 404 to a valid link once the capture is gone', async () => {
    const { id, captureKey } = await insertReport(worker.env, { capture: true });
    const { url } = await signCaptureLink('http://localhost', id, TOKEN);
    await worker.env.CAPTURES.delete(captureKey!);
    const res = await worker.call(new URL(url).pathname + new URL(url).search);
    expect(res.status).toBe(404);
  });
});
