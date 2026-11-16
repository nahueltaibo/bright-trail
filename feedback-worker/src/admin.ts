import { z } from 'zod';
import { handleAdminCapture } from './captures';
import { byMethod, json, type Env } from './env';

const STATUSES = ['new', 'filed', 'rejected'] as const;

const encoder = new TextEncoder();
const sha256 = async (text: string) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)));

/** Whether the request carries `Authorization: Bearer <FEEDBACK_ADMIN_TOKEN>`. */
export async function isAdmin(request: Request, env: Env): Promise<boolean> {
  const token = env.FEEDBACK_ADMIN_TOKEN;
  const match = /^Bearer (.+)$/i.exec(request.headers.get('Authorization') ?? '');
  if (!token || !match) return false;
  // Hashing gives both sides one length, and the loop never exits early, so timing leaks nothing.
  const [given, expected] = await Promise.all([sha256(match[1]), sha256(token)]);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= given[i] ^ expected[i];
  return diff === 0;
}

/** Routes `/admin/*`, after checking the bearer token. */
export async function handleAdmin(request: Request, env: Env, pathname: string) {
  if (!(await isAdmin(request, env))) {
    return json(
      401,
      { error: 'A valid admin token is required.' },
      { 'WWW-Authenticate': 'Bearer' },
    );
  }
  if (pathname === '/admin/reports') {
    return byMethod(request, {
      GET: () => listReports(request, env),
      PATCH: () => patchReports(request, env, null),
    });
  }
  const report = /^\/admin\/reports\/([^/]+)$/.exec(pathname);
  if (report) {
    return byMethod(request, {
      GET: () => getReport(env, report[1]),
      PATCH: () => patchReports(request, env, report[1]),
    });
  }
  const capture = /^\/admin\/captures\/([^/]+)$/.exec(pathname);
  if (capture) {
    return byMethod(request, { GET: () => handleAdminCapture(request, env, capture[1]) });
  }
  return json(404, { error: 'Not found.' });
}

// D1 compares received_at and issue_closed_at as text, so every stored time is UTC with a Z.
const toUtc = (value: string) => new Date(value).toISOString();
const DateParam = z.union([z.iso.date(), z.iso.datetime({ offset: true })]).transform(toUtc);

const ListQuerySchema = z.strictObject({
  status: z.enum(STATUSES).optional(),
  contentId: z.string().min(1).optional(),
  skillId: z.string().min(1).optional(),
  since: DateParam.optional(),
  until: DateParam.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});

const CursorSchema = z.tuple([z.string(), z.string()]);

interface ReportRow {
  id: string;
  received_at: string;
  status: string;
  group_key: string | null;
  issue_number: number | null;
  issue_closed_at: string | null;
  report: string;
}

const COLUMNS = 'id, received_at, status, group_key, issue_number, issue_closed_at, report';

const view = (row: ReportRow) => ({
  ...(JSON.parse(row.report) as object),
  status: row.status,
  groupKey: row.group_key,
  issueNumber: row.issue_number,
  issueClosedAt: row.issue_closed_at,
  receivedAt: row.received_at,
});

const badRequest = (message: string, error: z.ZodError) =>
  json(400, {
    error: message,
    issues: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
  });

/** GET /admin/reports: newest first, filtered, one page at a time. `next` is the next page's cursor. */
async function listReports(request: Request, env: Env) {
  const parsed = ListQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return badRequest('The query is not valid.', parsed.error);
  const query = parsed.data;

  const where: string[] = [];
  const values: unknown[] = [];
  const add = (clause: string, ...args: unknown[]) => {
    where.push(clause);
    values.push(...args);
  };
  if (query.status) add('status = ?', query.status);
  if (query.contentId) add('content_id = ?', query.contentId);
  if (query.skillId) add('skill_id = ?', query.skillId);
  if (query.since) add('received_at >= ?', query.since);
  if (query.until) add('received_at < ?', query.until);
  if (query.cursor) {
    const cursor = decodeCursor(query.cursor);
    if (!cursor) return json(400, { error: 'The cursor is not valid.' });
    add('(received_at < ? OR (received_at = ? AND id < ?))', cursor[0], cursor[0], cursor[1]);
  }

  const { results } = await env.DB.prepare(
    `SELECT ${COLUMNS} FROM reports ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY received_at DESC, id DESC LIMIT ?`,
  )
    .bind(...values, query.limit + 1)
    .all<ReportRow>();
  const page = results.slice(0, query.limit);
  const last = page.at(-1);
  const next = results.length > query.limit && last ? encodeCursor(last) : null;
  return json(200, { reports: page.map(view), next });
}

const encodeCursor = (row: ReportRow) =>
  btoa(JSON.stringify([row.received_at, row.id]))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

function decodeCursor(cursor: string): [string, string] | null {
  try {
    const parsed = CursorSchema.safeParse(
      JSON.parse(atob(cursor.replace(/-/g, '+').replace(/_/g, '/'))),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

async function getReport(env: Env, id: string) {
  const row = await env.DB.prepare(`SELECT ${COLUMNS} FROM reports WHERE id = ?`)
    .bind(id)
    .first<ReportRow>();
  return row ? json(200, view(row)) : json(404, { error: 'No report has this id.' });
}

const PatchFieldsSchema = z.strictObject({
  status: z.enum(STATUSES).optional(),
  groupKey: z.string().trim().min(1).max(200).nullable().optional(),
  issueNumber: z.number().int().positive().nullable().optional(),
  issueClosedAt: z.iso.datetime({ offset: true }).transform(toUtc).nullable().optional(),
});

const hasField = (fields: object) => Object.keys(fields).some((key) => key !== 'ids');
const NO_FIELD = {
  message: 'Set at least one of status, groupKey, issueNumber, or issueClosedAt.',
};

const BulkPatchSchema = PatchFieldsSchema.extend({
  ids: z.array(z.string().min(1)).min(1).max(200),
}).refine(hasField, NO_FIELD);
const OnePatchSchema = PatchFieldsSchema.refine(hasField, NO_FIELD);

const PATCH_COLUMNS = {
  status: 'status',
  groupKey: 'group_key',
  issueNumber: 'issue_number',
  issueClosedAt: 'issue_closed_at',
} as const;

/** PATCH /admin/reports with `ids`, or PATCH /admin/reports/:id without. Answers with the count changed. */
async function patchReports(request: Request, env: Env, id: string | null) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: 'The body is not valid JSON.' });
  }
  const parsed = id === null ? BulkPatchSchema.safeParse(body) : OnePatchSchema.safeParse(body);
  if (!parsed.success) return badRequest('The patch is not valid.', parsed.error);
  const fields: Record<string, unknown> = parsed.data;
  const ids = id === null ? (fields.ids as string[]) : [id];

  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [field, column] of Object.entries(PATCH_COLUMNS)) {
    if (field in fields) {
      sets.push(`${column} = ?`);
      values.push(fields[field]);
    }
  }
  // One JSON parameter, since D1 binds at most 100 parameters per query.
  const result = await env.DB.prepare(
    `UPDATE reports SET ${sets.join(', ')} WHERE id IN (SELECT value FROM json_each(?))`,
  )
    .bind(...values, JSON.stringify(ids))
    .run();
  const updated = result.meta.changes;
  if (id !== null && updated === 0) return json(404, { error: 'No report has this id.' });
  return json(200, { updated });
}
