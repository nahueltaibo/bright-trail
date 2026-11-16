import type { Report } from '@bright-trail/shared';
import { openRepository, type Repository } from '../storage/repository';
import { openNodeSqliteDatabase } from '../storage/testing/nodeSqliteDatabase';
import { syncFeedback, type FeedbackDeps } from './sync';

const REPORT_A = '6f1c2b1e-3a4d-4c55-9a0e-2f3b4c5d6e7f';
const REPORT_B = '0f8e7d6c-5b4a-4321-8fed-cba987654321';
const URL = 'https://feedback.example.dev/';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const report = (id: string, overrides: Partial<Report> = {}): Report => ({
  id,
  createdAt: '2026-11-16T14:30:00Z',
  comment: null,
  target: { contentKind: 'card', contentId: 'k-count-to-20-story', cardIndex: 2 },
  item: null,
  skillId: 'k-count-to-20',
  phase: 'check',
  content: { bundleVersion: 'sample-1', coreHash: 'a'.repeat(64), contentSchemaVersion: 5 },
  app: { appVersion: '3.0.0', runtimeVersion: '3', updateId: null },
  device: { platform: 'android', osVersion: '15', model: 'Samsung SM-X200' },
  screen: { width: 800, height: 1280, scale: 2, fontScale: 1 },
  settings: { readingMode: false, dyslexicFont: false },
  hasCapture: false,
  ...overrides,
});

/** The parts of a multipart body, as name and value. */
function parts(body: FormData): [string, unknown][] {
  const native = body as unknown as { getParts?: () => { fieldName: string; string?: string }[] };
  if (native.getParts) {
    return native.getParts().map((p) => [p.fieldName, p.string ?? p]);
  }
  return [...body.entries()];
}

function setup(answer: (call: number) => number | Error, overrides: Partial<FeedbackDeps> = {}) {
  const calls: { url: string; parts: [string, unknown][] }[] = [];
  const removed: string[] = [];
  const deps: FeedbackDeps = {
    baseUrl: URL,
    fetch: jest.fn(async (url: string, init: { body: FormData }) => {
      calls.push({ url, parts: parts(init.body) });
      const status = answer(calls.length);
      if (status instanceof Error) throw status;
      return { status };
    }),
    capturePart: async () => new Blob([PNG], { type: 'image/png' }),
    files: { remove: (uri) => void removed.push(uri) },
    now: () => new Date('2026-11-16T15:00:00Z'),
    ...overrides,
  };
  return { deps, calls, removed };
}

describe('syncFeedback', () => {
  let repo: Repository;

  beforeEach(async () => {
    repo = await openRepository(openNodeSqliteDatabase(':memory:'));
  });

  it('uploads each report with its capture, marks it sent, and deletes the capture', async () => {
    await repo.reports.enqueue(report(REPORT_A, { hasCapture: true }), 'file:///docs/a.png');
    const b = report(REPORT_B, { createdAt: '2026-11-16T14:40:00Z' });
    await repo.reports.enqueue(b, null);
    const { deps, calls, removed } = setup((n) => (n === 1 ? 201 : 200));

    await syncFeedback(repo, deps);

    expect(calls.map((c) => c.url)).toEqual([
      'https://feedback.example.dev/v1/reports',
      'https://feedback.example.dev/v1/reports',
    ]);
    expect(calls[0].parts).toEqual([
      ['report', JSON.stringify(report(REPORT_A, { hasCapture: true }))],
      ['capture', expect.any(Blob)],
    ]);
    expect(calls[1].parts).toEqual([['report', JSON.stringify(b)]]);
    expect(await repo.reports.listPending()).toEqual([]);
    expect(removed).toEqual(['file:///docs/a.png']);
  });

  it('marks a report the Worker refuses as rejected and goes on to the next', async () => {
    await repo.reports.enqueue(report(REPORT_A, { hasCapture: true }), 'file:///docs/a.png');
    await repo.reports.enqueue(report(REPORT_B, { createdAt: '2026-11-16T14:40:00Z' }), null);
    const { deps, calls, removed } = setup((n) => (n === 1 ? 400 : 201));

    await syncFeedback(repo, deps);

    expect(calls).toHaveLength(2);
    expect(await repo.reports.listPending()).toEqual([]);
    expect(removed).toEqual(['file:///docs/a.png']);
  });

  it.each([
    ['a rate limit', 429],
    ['a server error', 503],
    ['a network error', new TypeError('Network request failed')],
  ])('keeps reports queued and stops on %s', async (_, answer) => {
    await repo.reports.enqueue(report(REPORT_A, { hasCapture: true }), 'file:///docs/a.png');
    await repo.reports.enqueue(report(REPORT_B, { createdAt: '2026-11-16T14:40:00Z' }), null);
    const { deps, calls, removed } = setup(() => answer);

    await expect(syncFeedback(repo, deps)).resolves.toBeUndefined();

    expect(calls).toHaveLength(1);
    const pending = await repo.reports.listPending();
    expect(pending.map((q) => [q.report.id, q.attemptedAt])).toEqual([
      [REPORT_A, '2026-11-16T15:00:00.000Z'],
      [REPORT_B, null],
    ]);
    expect(removed).toEqual([]);
  });

  it('keeps reports queued without a Worker URL, and never calls fetch', async () => {
    await repo.reports.enqueue(report(REPORT_A), null);
    const { deps } = setup(() => 201, { baseUrl: undefined });

    await expect(syncFeedback(repo, deps)).resolves.toBeUndefined();

    expect(deps.fetch).not.toHaveBeenCalled();
    expect(await repo.reports.listPending()).toHaveLength(1);
  });

  it('sends a report whose capture is gone as one without a capture', async () => {
    await repo.reports.enqueue(report(REPORT_A, { hasCapture: true }), 'file:///docs/a.png');
    const { deps, calls } = setup(() => 201, { capturePart: async () => null });

    await syncFeedback(repo, deps);

    expect(calls[0].parts).toEqual([['report', JSON.stringify(report(REPORT_A))]]);
    expect(await repo.reports.listPending()).toEqual([]);
  });

  it('runs one sync at a time, and a call during a run gets one more pass', async () => {
    await repo.reports.enqueue(report(REPORT_A), null);
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { deps, calls } = setup(() => 201);
    const fetch = deps.fetch;
    const later = report(REPORT_B, { createdAt: '2026-11-16T14:40:00Z' });
    deps.fetch = async (url, init) => {
      // Queued after the run listed its reports, so only the extra pass sends it.
      if (calls.length === 0) await repo.reports.enqueue(later, null);
      await gate;
      return fetch(url, init);
    };

    const first = syncFeedback(repo, deps);
    expect(syncFeedback(repo, deps)).toBe(first);
    release();
    await first;

    expect(calls).toHaveLength(2);
    expect(await repo.reports.listPending()).toEqual([]);
  });
});
