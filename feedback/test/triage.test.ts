import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  insertReport,
  item,
  sampleReport,
  startWorker,
  TOKEN,
  type TestWorker,
} from '../../feedback-worker/test/helpers';
import { feedbackApi, type Fetch } from '../src/api';
import { file, group, pull, sync, type Context } from '../src/commands';
import { github, type Gh } from '../src/github';

let worker: TestWorker;
let inbox: string;

beforeAll(async () => {
  worker = await startWorker();
  inbox = await mkdtemp(join(tmpdir(), 'feedback-inbox-'));
}, 60_000);

afterAll(async () => {
  await worker?.dispose();
  await rm(inbox, { recursive: true, force: true });
});

interface FakeIssue {
  number: number;
  title: string;
  body: string;
  labels: { name: string }[];
  state: 'open' | 'closed';
  closed_at: string | null;
  comments: string[];
}

/** A `gh` that answers the REST calls triage makes from memory, and records each one. */
function fakeGh() {
  const issues: FakeIssue[] = [];
  const labels = [{ name: 'content' }, { name: 'app' }];
  const calls: { args: string[]; input?: string }[] = [];
  let failTitle: string | null = null;
  const page = <T>(items: T[], query: URLSearchParams) => {
    const n = Number(query.get('page') ?? 1);
    const size = Number(query.get('per_page') ?? 30);
    return items.slice((n - 1) * size, n * size);
  };
  const view = (issue: FakeIssue) => ({ ...issue, html_url: `https://gh/${issue.number}` });

  const gh: Gh = async (args, input) => {
    calls.push({ args, input });
    const [, target, , method = 'GET'] = args;
    const url = new URL(target.replace('repos/{owner}/{repo}', 'http://gh'));
    const body = input ? JSON.parse(input) : undefined;
    const path = url.pathname;
    let result: unknown;
    if (path === '/labels') {
      if (method === 'POST') labels.push(body);
      result = method === 'POST' ? body : page(labels, url.searchParams);
    } else if (path === '/issues' && method === 'POST') {
      if (body.title === failTitle) throw new Error('gh: Validation Failed (HTTP 422)');
      const issue: FakeIssue = {
        number: issues.length + 1,
        title: body.title,
        body: body.body,
        labels: body.labels.map((name: string) => ({ name })),
        state: 'open',
        closed_at: null,
        comments: [],
      };
      issues.push(issue);
      result = view(issue);
    } else if (path === '/issues') {
      const label = url.searchParams.get('labels');
      const matching = issues.filter(
        (i) => i.state === url.searchParams.get('state') && i.labels.some((l) => l.name === label),
      );
      result = page(matching, url.searchParams).map(view);
    } else {
      const [, , number, comments] = path.split('/');
      const issue = issues.find((i) => i.number === Number(number));
      if (!issue) throw new Error('gh: Not Found (HTTP 404)');
      if (comments && method === 'POST') issue.comments.push(body.body);
      result = comments
        ? page(
            issue.comments.map((c) => ({ body: c })),
            url.searchParams,
          )
        : view(issue);
    }
    return JSON.stringify(result);
  };
  const writes = () => calls.filter((c) => c.args.includes('POST'));
  const failCreating = (title: string) => (failTitle = title);
  return { gh, issues, labels, writes, failCreating };
}

let fake: ReturnType<typeof fakeGh>;
let patches: number;
let links: number;
let failNextPatch: boolean;
const lines: string[] = [];

const workerFetch: Fetch = async (input, init) => {
  const url = new URL(input);
  if (url.searchParams.get('link') === '1') links++;
  if (init?.method === 'PATCH') {
    patches++;
    if (failNextPatch) {
      failNextPatch = false;
      throw new Error('Network down');
    }
  }
  return worker.call(`${url.pathname}${url.search}`, init);
};

const api = feedbackApi({ baseUrl: 'http://localhost/', token: TOKEN, fetch: workerFetch });

const context = (extra: Partial<Context> = {}): Context => ({
  api,
  github: github(fake.gh),
  log: (line) => lines.push(line),
  inbox,
  ...extra,
});

const report = (overrides: Record<string, unknown> = {}) => sampleReport(overrides);

beforeEach(async () => {
  await worker.reset();
  fake = fakeGh();
  patches = 0;
  links = 0;
  failNextPatch = false;
  lines.length = 0;
});

describe('file', () => {
  it('files 3 reports on one item as one issue and marks them filed', async () => {
    const ids = await Promise.all(
      [1, 2, 3].map(async (n) => (await insertReport(worker.env, { capture: n === 1 })).id),
    );

    await file(context());

    expect(fake.issues).toHaveLength(1);
    const [issue] = fake.issues;
    expect(issue.title).toBe(`Feedback: item ${item.id}`);
    expect(issue.labels.map((l) => l.name)).toEqual(['feedback', 'content']);
    expect(fake.labels.map((l) => l.name)).toContain('feedback');
    for (const id of ids) expect(issue.body).toContain(`<!-- feedback-report: ${id} -->`);
    expect(issue.body).toContain('| Reports | 3 |');
    expect(issue.body).toContain('| Game | compare |');
    expect(issue.body).toMatch(
      /\[open\]\(http:\/\/localhost\/captures\/[^)]+\)\. The link expires/,
    );
    expect(issue.body).not.toContain('data:image');

    const filed = await api.listReports('filed');
    expect(filed.map((r) => r.id).sort()).toEqual([...ids].sort());
    for (const r of filed) {
      expect(r.issueNumber).toBe(1);
      expect(r.groupKey).toBe(`item:${item.id}`);
    }
  });

  it('shows [removed] in place of an email in the comment', async () => {
    await insertReport(worker.env, {
      report: report({ comment: 'Wrong towers. Mail me at mom@example.com @someone' }),
    });

    await file(context());

    const { body } = fake.issues[0];
    expect(body).not.toContain('mom@example.com');
    expect(body).toContain('> Wrong towers. Mail me at [removed] @\u200Bsomeone');
    expect(body).toContain('"comment": "Wrong towers. Mail me at [removed] @\u200Bsomeone"');
  });

  it('scrubs every string in the report, not only the comment', async () => {
    const base = sampleReport();
    await insertReport(worker.env, {
      report: {
        ...base,
        item: { ...item, prompt: 'Ask dad@example.com which is less?' },
        device: { ...base.device, model: 'Pixel https://evil.example/x' },
      },
    });

    await file(context());

    const { body } = fake.issues[0];
    expect(body).not.toContain('dad@example.com');
    expect(body).not.toContain('evil.example');
    expect(body).toContain('| Prompt | Ask \\[removed\\] which is less? |');
    expect(body).toContain('"model": "Pixel [removed]"');
    expect(body).toContain(`"id": "${base.id}"`);
    expect(body).toContain(`"coreHash": "${base.content.coreHash}"`);
  });

  it('files the other groups when one fails', async () => {
    await insertReport(worker.env);
    const other = await insertReport(worker.env, {
      report: report({ target: { contentKind: 'item', contentId: 'other', cardIndex: null } }),
    });
    fake.failCreating(`Feedback: item ${item.id}`);

    await expect(file(context())).rejects.toThrow('1 of 2 groups failed to file.');

    expect(fake.issues.map((i) => i.title)).toEqual(['Feedback: item other']);
    expect((await api.listReports('filed')).map((r) => r.id)).toEqual([other.id]);
    expect(lines.some((l) => l.startsWith(`Failed item:${item.id}: gh: Validation Failed`))).toBe(
      true,
    );
  });

  it('files a report whose capture is missing, without a link', async () => {
    await insertReport(worker.env, { report: report({ hasCapture: true }) });

    await file(context());

    expect(fake.issues[0].body).toContain('Capture: none could be linked.');
    expect(await api.listReports('filed')).toHaveLength(1);
  });

  it('files card reports by nugget and card', async () => {
    const card = (cardIndex: number) =>
      report({
        target: { contentKind: 'card', contentId: 'k-count-story', cardIndex },
        item: null,
      });
    await insertReport(worker.env, { report: card(0) });
    await insertReport(worker.env, { report: card(0) });
    await insertReport(worker.env, { report: card(2) });

    await file(context());

    expect(fake.issues.map((i) => i.title).sort()).toEqual([
      'Feedback: story card 1 of k-count-story',
      'Feedback: story card 3 of k-count-story',
    ]);
  });

  it('files nothing twice when run again', async () => {
    await insertReport(worker.env);
    await file(context());
    await file(context());

    expect(fake.issues).toHaveLength(1);
    expect(fake.issues[0].comments).toEqual([]);
    expect(lines.at(-1)).toBe('No new reports.');
  });

  it('recovers when it stops between filing the issue and marking the reports', async () => {
    await insertReport(worker.env);
    await insertReport(worker.env);
    failNextPatch = true;

    await expect(file(context())).rejects.toThrow('1 of 1 group failed to file.');
    expect(lines).toContain(`Failed item:${item.id}: Network down`);
    expect(await api.listReports('new')).toHaveLength(2);

    await file(context());

    expect(fake.issues).toHaveLength(1);
    expect(fake.issues[0].comments).toEqual([]);
    const filed = await api.listReports('filed');
    expect(filed.map((r) => r.issueNumber)).toEqual([1, 1]);
  });

  it('adds a later report to the open issue as a comment, and files anew once it closes', async () => {
    await insertReport(worker.env);
    await file(context());

    const { id } = await insertReport(worker.env);
    await file(context());
    expect(fake.issues).toHaveLength(1);
    expect(fake.issues[0].comments).toHaveLength(1);
    expect(fake.issues[0].comments[0]).toContain(`<!-- feedback-report: ${id} -->`);
    expect(fake.issues[0].comments[0]).toMatch(/^1 more report in this group\./);

    fake.issues[0].state = 'closed';
    await insertReport(worker.env);
    await file(context());
    expect(fake.issues).toHaveLength(2);
    expect(fake.issues[1].state).toBe('open');
  });

  it('creates nothing and patches nothing with --dry-run', async () => {
    await insertReport(worker.env);
    await insertReport(worker.env);

    await insertReport(worker.env, { capture: true });

    await file(context({ dryRun: true }));

    expect(fake.writes()).toEqual([]);
    expect(patches).toBe(0);
    expect(links).toBe(0);
    expect(await api.listReports('new')).toHaveLength(3);
    expect(lines[0]).toBe(
      `Would file "Feedback: item ${item.id}" [feedback, content] for item:${item.id}:`,
    );
    expect(lines[1]).toContain('| Reports | 3 |');
    expect(lines[1]).toContain('Capture: [open](<signed link>)');
  });
});

describe('group', () => {
  it('keys new reports by item, and leaves set groups alone unless asked', async () => {
    const a = await insertReport(worker.env);
    await api.patchReports([a.id], { groupKey: 'custom' });
    const b = await insertReport(worker.env);
    const other = await insertReport(worker.env, {
      report: report({ target: { contentKind: 'item', contentId: 'other', cardIndex: null } }),
    });

    await group(context({ dryRun: true }));
    expect(patches).toBe(1);

    await group(context());
    const key = async (id: string) =>
      (await api.listReports('new')).find((r) => r.id === id)?.groupKey;
    expect(await key(a.id)).toBe('custom');
    expect(await key(b.id)).toBe(`item:${item.id}`);
    expect(await key(other.id)).toBe('item:other');

    await group(context({ regroup: true }));
    expect(await key(a.id)).toBe(`item:${item.id}`);
  });

  it('keys by skill with --by skill, and file files one issue per skill', async () => {
    await insertReport(worker.env);
    await insertReport(worker.env, {
      report: report({ target: { contentKind: 'item', contentId: 'other', cardIndex: null } }),
    });

    await group(context({ by: 'skill' }));
    await file(context());

    expect(fake.issues.map((i) => i.title)).toEqual([`Feedback: skill ${item.skillId}`]);
    const filed = await api.listReports('filed');
    expect(filed.map((r) => r.groupKey)).toEqual([
      `skill:${item.skillId}`,
      `skill:${item.skillId}`,
    ]);
  });
});

describe('sync', () => {
  it('copies the close time to filed reports, and clears it when the issue reopens', async () => {
    await insertReport(worker.env);
    await insertReport(worker.env);
    await file(context());

    await sync(context());
    expect((await api.listReports('filed')).map((r) => r.issueClosedAt)).toEqual([null, null]);

    fake.issues[0].state = 'closed';
    fake.issues[0].closed_at = '2026-11-20T10:00:00Z';
    await sync(context());
    expect((await api.listReports('filed')).map((r) => r.issueClosedAt)).toEqual([
      '2026-11-20T10:00:00.000Z',
      '2026-11-20T10:00:00.000Z',
    ]);

    fake.issues[0].state = 'open';
    fake.issues[0].closed_at = null;
    await sync(context());
    expect((await api.listReports('filed')).map((r) => r.issueClosedAt)).toEqual([null, null]);
  });

  it('takes the new close time when an issue reopened and closed between syncs', async () => {
    await insertReport(worker.env);
    await file(context());
    fake.issues[0].state = 'closed';
    fake.issues[0].closed_at = '2026-11-20T10:00:00Z';
    await sync(context());

    fake.issues[0].closed_at = '2026-12-01T08:30:00Z';
    await sync(context());
    expect((await api.listReports('filed')).map((r) => r.issueClosedAt)).toEqual([
      '2026-12-01T08:30:00.000Z',
    ]);

    patches = 0;
    await sync(context());
    expect(patches).toBe(0);
  });
});

describe('pull', () => {
  it('saves new reports and their captures, and drops ones no longer new', async () => {
    const withCapture = await insertReport(worker.env, { capture: true });
    const plain = await insertReport(worker.env);
    await pull(context());
    expect((await readdir(inbox)).sort()).toEqual(
      [`${withCapture.id}.json`, `${withCapture.id}.png`, `${plain.id}.json`].sort(),
    );
    expect(lines.at(-1)).toMatch(/^Pulled 2 new reports and 1 capture into /);

    await api.patchReports([withCapture.id], { status: 'rejected' });
    await writeFile(join(inbox, 'notes.txt'), 'mine');
    await pull(context());
    expect((await readdir(inbox)).sort()).toEqual([`${plain.id}.json`, 'notes.txt']);
    await rm(join(inbox, 'notes.txt'));
  });

  it('logs a capture it cannot download and saves the rest', async () => {
    const missing = await insertReport(worker.env, { report: report({ hasCapture: true }) });
    const plain = await insertReport(worker.env);

    await pull(context());

    expect((await readdir(inbox)).sort()).toEqual(
      [`${missing.id}.json`, `${plain.id}.json`].sort(),
    );
    expect(lines[0]).toMatch(new RegExp(`^No capture for ${missing.id}: .*404`));
  });
});
