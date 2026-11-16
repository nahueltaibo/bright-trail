import { spawn } from 'node:child_process';

/** Runs `gh` with these arguments and stdin, and answers its stdout. Tests pass a stub. */
export type Gh = (args: string[], input?: string) => Promise<string>;

/** The real `gh`, or the binary in `GH_BIN`. `{owner}/{repo}` comes from the checkout or `GH_REPO`. */
export const runGh: Gh = (args, input) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.env.GH_BIN ?? 'gh', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', reject);
    child.on('close', (code) =>
      code === 0
        ? resolve(stdout)
        : reject(new Error(`gh ${args.join(' ')} failed (${code}): ${stderr.trim()}`)),
    );
    child.stdin.end(input ?? '');
  });

export interface Issue {
  number: number;
  state: 'open' | 'closed';
  closed_at: string | null;
  body: string | null;
  html_url: string;
  pull_request?: unknown;
}

const REPO = 'repos/{owner}/{repo}';

/** GitHub's REST API through `gh api`, which spends none of the scarcer GraphQL quota. */
export function github(gh: Gh = runGh) {
  const get = async <T>(path: string) => JSON.parse(await gh(['api', path])) as T;
  const post = async <T>(path: string, body: object) =>
    JSON.parse(await gh(['api', path, '-X', 'POST', '--input', '-'], JSON.stringify(body))) as T;

  async function all<T>(path: string): Promise<T[]> {
    const items: T[] = [];
    const join = path.includes('?') ? '&' : '?';
    for (let page = 1; ; page++) {
      const batch = await get<T[]>(`${path}${join}per_page=100&page=${page}`);
      items.push(...batch);
      if (batch.length < 100) return items;
    }
  }

  return {
    /** Creates the labels the repo lacks, so filing never depends on GitHub auto-creating them. */
    async ensureLabels(labels: { name: string; color: string; description: string }[]) {
      const have = new Set((await all<{ name: string }>(`${REPO}/labels`)).map((l) => l.name));
      for (const label of labels) {
        if (!have.has(label.name)) await post(`${REPO}/labels`, label);
      }
    },
    /** Open issues with this label. Pull requests are left out. */
    openIssues: async (label: string) =>
      (await all<Issue>(`${REPO}/issues?state=open&labels=${encodeURIComponent(label)}`)).filter(
        (issue) => !issue.pull_request,
      ),
    commentBodies: async (issue: number) =>
      (await all<{ body: string | null }>(`${REPO}/issues/${issue}/comments`)).map(
        (c) => c.body ?? '',
      ),
    createIssue: (issue: { title: string; body: string; labels: string[] }) =>
      post<Issue>(`${REPO}/issues`, issue),
    comment: (issue: number, body: string) => post(`${REPO}/issues/${issue}/comments`, { body }),
    issue: (issue: number) => get<Issue>(`${REPO}/issues/${issue}`),
  };
}

export type GitHub = ReturnType<typeof github>;
