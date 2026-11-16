import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import worker from '../src';
import { MAX_BATCHES, runRetention } from '../src/retention';
import { insertReport, sampleReport, startWorker, type TestWorker } from './helpers';

let test: TestWorker;

const NOW = Date.parse('2026-11-16T04:00:00.000Z');
const NOW_ISO = new Date(NOW).toISOString();
const daysAgo = (days: number) => new Date(NOW - days * 24 * 60 * 60 * 1000).toISOString();

beforeAll(async () => {
  test = await startWorker();
}, 60_000);

afterAll(async () => {
  await test?.dispose();
});

beforeEach(async () => {
  await test.reset();
});

async function remaining() {
  const { results } = await test.env.DB.prepare('SELECT id FROM reports').all<{ id: string }>();
  return results.map((r) => r.id).sort();
}

describe('retention', () => {
  it('deletes reports and captures past retention, and keeps the rest', async () => {
    const add = (options: Parameters<typeof insertReport>[1]) =>
      insertReport(test.env, { capture: true, ...options });
    const keep = [
      await add({ status: 'filed', receivedAt: daysAgo(400) }),
      await add({ status: 'new', receivedAt: daysAgo(179) }),
      await add({ status: 'filed', receivedAt: daysAgo(200), issueClosedAt: daysAgo(89) }),
    ];
    const drop = [
      await add({ status: 'filed', receivedAt: daysAgo(120), issueClosedAt: daysAgo(91) }),
      await add({ status: 'rejected', receivedAt: daysAgo(181) }),
      await add({ status: 'new', receivedAt: daysAgo(181) }),
      await insertReport(test.env, { status: 'new', receivedAt: daysAgo(181) }),
    ];

    expect(await runRetention(test.env, NOW)).toEqual({ deleted: drop.length });

    expect(await remaining()).toEqual(keep.map((r) => r.id).sort());
    for (const { captureKey } of keep) {
      expect(await test.env.CAPTURES.head(captureKey!)).not.toBe(null);
    }
    for (const { captureKey } of drop.slice(0, 3)) {
      expect(await test.env.CAPTURES.head(captureKey!)).toBe(null);
    }
  });

  it('works through more reports than one batch', async () => {
    for (let i = 0; i < 230; i++) {
      await insertReport(test.env, { receivedAt: daysAgo(200), capture: i % 2 === 0 });
    }
    expect(await runRetention(test.env, NOW)).toEqual({ deleted: 230 });
    expect(await remaining()).toEqual([]);
    expect((await test.env.CAPTURES.list()).objects).toEqual([]);
  });

  it('stops at 1,000 reports per run and drains the rest on the next run', async () => {
    const backlog = MAX_BATCHES * 100 + 50;
    const insert = test.env.DB.prepare(
      `INSERT INTO reports (id, created_at, received_at, content_kind, content_id, skill_id, report)
       VALUES (?, ?, ?, 'item', 'x', 'y', '{}')`,
    );
    const rows = Array.from({ length: backlog }, () =>
      insert.bind(sampleReport().id, NOW_ISO, daysAgo(200)),
    );
    for (let i = 0; i < rows.length; i += 200) await test.env.DB.batch(rows.slice(i, i + 200));

    expect(await runRetention(test.env, NOW)).toEqual({ deleted: MAX_BATCHES * 100 });
    expect(await remaining()).toHaveLength(50);
    expect(await runRetention(test.env, NOW)).toEqual({ deleted: 50 });
    expect(await remaining()).toEqual([]);
  });

  it('prunes daily usage older than 180 days', async () => {
    const insert = test.env.DB.prepare('INSERT INTO daily_usage (day, reports) VALUES (?, 1)');
    await test.env.DB.batch([
      insert.bind(daysAgo(181).slice(0, 10)),
      insert.bind(daysAgo(10).slice(0, 10)),
    ]);
    await runRetention(test.env, NOW);
    const { results } = await test.env.DB.prepare('SELECT day FROM daily_usage').all();
    expect(results).toEqual([{ day: daysAgo(10).slice(0, 10) }]);
  });

  it('runs from the scheduled handler', async () => {
    const old = await insertReport(test.env, { receivedAt: daysAgo(181), capture: true });
    const waits: Promise<unknown>[] = [];
    await worker.scheduled(
      { scheduledTime: NOW, cron: '0 4 * * *', noRetry: () => {} } as never,
      test.env,
      {
        waitUntil: (p: Promise<unknown>) => waits.push(p),
        passThroughOnException: () => {},
      } as never,
    );
    await Promise.all(waits);
    expect(await remaining()).toEqual([]);
    expect(await test.env.CAPTURES.head(old.captureKey!)).toBe(null);
  });
});
