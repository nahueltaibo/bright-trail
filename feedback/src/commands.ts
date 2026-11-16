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
  pack,
  reportSection,
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
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

const EXTENSIONS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg' };

/** Saves every new report, and its capture, to the inbox. Files of reports no longer new go. */
export async function pull({ api, log, inbox }: Context) {
  const reports = await api.listReports('new');
  await mkdir(inbox, { recursive: true });
  const ids = new Set(reports.map((r) => r.id));
  for (const name of await readdir(inbox)) {
    if (!ids.has(name.replace(/\.[^.]+$/, ''))) await rm(join(inbox, name), { recursive: true });
  }
  let captures = 0;
  for (const report of reports) {
    await writeFile(join(inbox, `${report.id}.json`), `${JSON.stringify(report, null, 2)}\n`);
    if (!report.hasCapture) continue;
    const { bytes, contentType } = await api.capture(report.id);
    await writeFile(join(inbox, `${report.id}.${EXTENSIONS[contentType] ?? 'bin'}`), bytes);
    captures++;
  }
  log(
    `Pulled ${plural(reports.length, 'new report')} and ${plural(captures, 'capture')} into ${inbox}.`,
  );
}

/** Sets `groupKey` on new reports that have none, or on every new report with `regroup`. */
export async function group({ api, log, dryRun, regroup }: Context) {
  const reports = await api.listReports('new');
  const moves = new Map<string, string[]>();
  for (const report of reports) {
    if (report.groupKey && !regroup) continue;
    const key = groupKeyOf(report);
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

/**
 * Files each group of new reports as one issue, then marks them filed. An open `feedback` issue
 * whose marker names the group gets only the reports it lacks, so a rerun files nothing twice.
 */
export async function file({ api, github, log, dryRun }: Context) {
  const reports = await api.listReports('new');
  if (reports.length === 0) return log('No new reports.');

  const open = new Map<string, number>();
  for (const issue of await github.openIssues(FEEDBACK_LABEL)) {
    const key = markedGroup(issue.body);
    if (key && !open.has(key)) open.set(key, issue.number);
  }
  if (!dryRun) await github.ensureLabels(LABELS);

  for (const [key, members] of groupReports(reports)) {
    let number = open.get(key);
    const filed = number
      ? markedReports([(await github.issue(number)).body, ...(await github.commentBodies(number))])
      : new Set<string>();
    const pending = members.filter((r) => !filed.has(r.id));
    const sections = await Promise.all(
      pending.map(async (r) =>
        reportSection(r, r.hasCapture ? await api.captureLink(r.id) : undefined),
      ),
    );

    if (number) {
      const comments = pending.length > 0 ? pack(commentHead(pending), sections) : [];
      if (dryRun) {
        log(`Would add ${plural(pending.length, 'report')} to #${number} for ${key}.`);
        comments.forEach((text) => log(text));
        continue;
      }
      for (const text of comments) await github.comment(number, text);
    } else {
      const [body, ...comments] = pack(issueHead(key, members), sections);
      const issue = { title: issueTitle(members[0]), body, labels: labelsFor() };
      if (dryRun) {
        log(`Would file "${issue.title}" [${issue.labels.join(', ')}] for ${key}:`);
        [body, ...comments].forEach((text) => log(text));
        continue;
      }
      number = (await github.createIssue(issue)).number;
      for (const text of comments) await github.comment(number, text);
    }

    const ids = members.map((r) => r.id);
    await api.patchReports(ids, { status: 'filed', issueNumber: number, groupKey: key });
    log(`Filed ${plural(ids.length, 'report')} for ${key} as #${number}.`);
  }
}

/**
 * Copies each issue's close time to its filed reports, which starts their retention clock.
 * A reopened issue clears it, so the cron can't delete reports a live issue still links.
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
      log(`Skipped #${number}: ${(error as Error).message}`);
      continue;
    }
    const closedAt = issue.state === 'closed' ? issue.closed_at : null;
    const stale = reports.filter((r) =>
      closedAt === null ? r.issueClosedAt !== null : r.issueClosedAt === null,
    );
    if (stale.length === 0) continue;
    if (!dryRun) {
      await api.patchReports(
        stale.map((r) => r.id),
        { issueClosedAt: closedAt },
      );
    }
    log(
      `${dryRun ? 'Would mark' : 'Marked'} ${plural(stale.length, 'report')} on #${number} as ${closedAt ? `closed ${closedAt}` : 'reopened'}.`,
    );
  }
  log(`Checked ${plural(byIssue.size, 'issue')}.`);
}
