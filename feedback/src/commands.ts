import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AdminReport, FeedbackApi } from './api';
import type { GitHub } from './github';
import {
  commentHead,
  FEEDBACK_LABEL,
  groupKeyOf,
  groupReports,
  issueHead,
  issueTitle,
  LABELS,
  labelsFor,
  markedGroup,
  markedReports,
  markerKey,
  pack,
  reportSection,
  type CaptureLink,
  type GroupBy,
} from './issue';

export interface Context {
  api: FeedbackApi;
  github: GitHub;
  log: (line: string) => void;
  /** Where `pull` writes. */
  inbox: string;
  dryRun?: boolean;
  /** `group` also rekeys reports that already have a group. */
  regroup?: boolean;
  /** What `group` keys reports by. Defaults to `item`. */
  by?: GroupBy;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' };
const INBOX_FILE = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}\.(json|png|jpg|bin)$/i;

/** Saves every new report, and its capture, to the inbox, and drops files of reports no longer new. */
export async function pull({ api, log, inbox }: Context) {
  const reports = await api.listReports('new');
  await mkdir(inbox, { recursive: true });
  const ids = new Set(reports.map((r) => r.id));
  for (const name of await readdir(inbox)) {
    if (INBOX_FILE.test(name) && !ids.has(name.replace(/\.[^.]+$/, ''))) {
      await rm(join(inbox, name));
    }
  }
  let captures = 0;
  for (const report of reports) {
    await writeFile(join(inbox, `${report.id}.json`), `${JSON.stringify(report, null, 2)}\n`);
    if (!report.hasCapture) continue;
    try {
      const { bytes, contentType } = await api.capture(report.id);
      await writeFile(join(inbox, `${report.id}.${EXTENSIONS[contentType] ?? 'bin'}`), bytes);
      captures++;
    } catch (error) {
      log(`No capture for ${report.id}: ${message(error)}`);
    }
  }
  log(
    `Pulled ${plural(reports.length, 'new report')} and ${plural(captures, 'capture')} into ${inbox}.`,
  );
}

/** Sets `groupKey` on new reports that have none, or on every new report with `regroup`. */
export async function group({ api, log, dryRun, regroup, by = 'item' }: Context) {
  const reports = await api.listReports('new');
  const moves = new Map<string, string[]>();
  for (const report of reports) {
    if (report.groupKey && !regroup) continue;
    const key = groupKeyOf(report, by);
    if (key === report.groupKey) continue;
    moves.set(key, [...(moves.get(key) ?? []), report.id]);
    report.groupKey = key;
  }
  for (const [key, ids] of moves) {
    if (!dryRun) await api.patchReports(ids, { groupKey: key });
    log(`${dryRun ? 'Would group' : 'Grouped'} ${plural(ids.length, 'report')} as ${key}.`);
  }
  for (const [key, members] of groupReports(reports)) {
    log(`${key}: ${plural(members.length, 'report')}`);
  }
}

const DRY_LINK: CaptureLink = { url: '<signed link>', expiresAt: 'in 7 days' };

/**
 * Files each group as one issue, or adds its missing reports to the group's open issue, so a
 * rerun files nothing twice. A failed group is logged and the rest still file.
 */
export async function file(context: Context) {
  const { api, github, log, dryRun } = context;
  const reports = await api.listReports('new');
  if (reports.length === 0) return log('No new reports.');

  const open = new Map<string, number>();
  for (const issue of await github.openIssues(FEEDBACK_LABEL)) {
    const key = markedGroup(issue.body);
    if (key && !open.has(key)) open.set(key, issue.number);
  }
  if (!dryRun) await github.ensureLabels(LABELS);

  const groups = groupReports(reports);
  let failed = 0;
  for (const [key, members] of groups) {
    try {
      await fileGroup(context, key, members, open.get(markerKey(key)));
    } catch (error) {
      failed++;
      log(`Failed ${key}: ${message(error)}`);
    }
  }
  if (failed > 0) throw new Error(`${failed} of ${plural(groups.size, 'group')} failed to file.`);
}

async function fileGroup(
  { api, github, log, dryRun }: Context,
  key: string,
  members: AdminReport[],
  existing: number | undefined,
) {
  const filed = existing
    ? markedReports([
        (await github.issue(existing)).body,
        ...(await github.commentBodies(existing)),
      ])
    : new Set<string>();
  const pending = members.filter((r) => !filed.has(r.id));
  const sections = await Promise.all(
    pending.map(async (r) => reportSection(r, await captureLink(api, r, dryRun))),
  );

  let number = existing;
  if (number) {
    const comments = pending.length > 0 ? pack(commentHead(pending), sections) : [];
    if (dryRun) {
      log(`Would add ${plural(pending.length, 'report')} to #${number} for ${key}.`);
      return comments.forEach((text) => log(text));
    }
    for (const text of comments) await github.comment(number, text);
  } else {
    const [body, ...comments] = pack(issueHead(key, members), sections);
    const issue = { title: issueTitle(key, members[0]), body, labels: labelsFor() };
    if (dryRun) {
      log(`Would file "${issue.title}" [${issue.labels.join(', ')}] for ${key}:`);
      return [body, ...comments].forEach((text) => log(text));
    }
    number = (await github.createIssue(issue)).number;
    for (const text of comments) await github.comment(number, text);
  }

  const ids = members.map((r) => r.id);
  await api.patchReports(ids, { status: 'filed', issueNumber: number, groupKey: key });
  log(`Filed ${plural(ids.length, 'report')} for ${key} as #${number}.`);
}

// A dry run mints no links, and a missing capture shows as unlinked instead of failing the group.
async function captureLink(api: FeedbackApi, report: AdminReport, dryRun?: boolean) {
  if (!report.hasCapture) return undefined;
  if (dryRun) return DRY_LINK;
  try {
    return await api.captureLink(report.id);
  } catch {
    return undefined;
  }
}

const sameTime = (a: string | null, b: string | null) =>
  a === b || (a !== null && b !== null && Date.parse(a) === Date.parse(b));

/**
 * Copies each issue's close time to its filed reports, which starts their retention clock. A
 * reopened issue clears it, so the cron can't delete reports a live issue still links.
 */
export async function sync({ api, github, log, dryRun }: Context) {
  const byIssue = new Map<number, AdminReport[]>();
  for (const report of await api.listReports('filed')) {
    if (report.issueNumber === null) continue;
    byIssue.set(report.issueNumber, [...(byIssue.get(report.issueNumber) ?? []), report]);
  }
  for (const [number, reports] of byIssue) {
    let issue;
    try {
      issue = await github.issue(number);
    } catch (error) {
      log(`Skipped #${number}: ${message(error)}`);
      continue;
    }
    const closedAt = issue.state === 'closed' ? issue.closed_at : null;
    const stale = reports.filter((r) => !sameTime(r.issueClosedAt, closedAt));
    if (stale.length === 0) continue;
    if (!dryRun) {
      await api.patchReports(
        stale.map((r) => r.id),
        { issueClosedAt: closedAt },
      );
    }
    log(
      `${dryRun ? 'Would mark' : 'Marked'} ${plural(stale.length, 'report')} on #${number} as ${closedAt ? `closed ${closedAt}` : 'open'}.`,
    );
  }
  log(`Checked ${plural(byIssue.size, 'issue')}.`);
}
