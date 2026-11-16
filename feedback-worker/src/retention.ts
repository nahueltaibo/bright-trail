import type { Env } from './env';

const DAY_MS = 24 * 60 * 60 * 1000;

export const RETENTION_DAYS = {
  afterIssueCloses: 90,
  neverFiled: 180,
  dailyUsage: 180,
};

const BATCH = 100;
// Each batch costs 3 subrequests, and the free plan allows 50 per run. The next run continues.
export const MAX_BATCHES = 10;

/** Deletes reports and captures past retention, at most 1,000 per run. See docs/setup-feedback.md. */
export async function runRetention(env: Env, now = Date.now()): Promise<{ deleted: number }> {
  const closedBefore = new Date(now - RETENTION_DAYS.afterIssueCloses * DAY_MS).toISOString();
  const receivedBefore = new Date(now - RETENTION_DAYS.neverFiled * DAY_MS).toISOString();
  let deleted = 0;
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { results } = await env.DB.prepare(
      `SELECT id, capture_key FROM reports
       WHERE issue_closed_at < ? OR (status != 'filed' AND received_at < ?)
       LIMIT ?`,
    )
      .bind(closedBefore, receivedBefore, BATCH)
      .all<{ id: string; capture_key: string | null }>();
    if (results.length === 0) break;
    const keys = results.flatMap((row) => (row.capture_key ? [row.capture_key] : []));
    // Captures go before rows, so a failed run leaves rows the next run retries, not orphaned captures.
    if (keys.length > 0) await env.CAPTURES.delete(keys);
    await env.DB.prepare('DELETE FROM reports WHERE id IN (SELECT value FROM json_each(?))')
      .bind(JSON.stringify(results.map((row) => row.id)))
      .run();
    deleted += results.length;
    if (results.length < BATCH) break;
  }

  const usageBefore = new Date(now - RETENTION_DAYS.dailyUsage * DAY_MS).toISOString().slice(0, 10);
  await env.DB.prepare('DELETE FROM daily_usage WHERE day < ?').bind(usageBefore).run();
  return { deleted };
}
