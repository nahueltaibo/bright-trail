import type { Report } from '@bright-trail/shared';

export const STATUSES = ['new', 'filed', 'rejected'] as const;
export type Status = (typeof STATUSES)[number];

/** A report as the admin routes return it: the upload plus what triage has set on it. */
export type AdminReport = Report & {
  status: Status;
  groupKey: string | null;
  issueNumber: number | null;
  issueClosedAt: string | null;
  receivedAt: string;
};

export interface ReportPatch {
  status?: Status;
  groupKey?: string | null;
  issueNumber?: number | null;
  issueClosedAt?: string | null;
}

/** The Worker's PATCH takes at most this many ids. */
export const PATCH_LIMIT = 200;

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The feedback Worker's admin routes. */
export function feedbackApi({
  baseUrl,
  token,
  fetch = globalThis.fetch,
}: {
  baseUrl: string;
  token: string;
  fetch?: Fetch;
}) {
  const root = baseUrl.replace(/\/+$/, '');
  async function call(path: string, init: RequestInit = {}) {
    const res = await fetch(`${root}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, ...init.headers },
    });
    if (!res.ok) {
      throw new Error(
        `${init.method ?? 'GET'} ${path} answered ${res.status}: ${await res.text()}`,
      );
    }
    return res;
  }

  return {
    /** Every report with this status, following `next` until the last page. */
    async listReports(status: Status): Promise<AdminReport[]> {
      const reports: AdminReport[] = [];
      let cursor: string | null = null;
      do {
        const query = new URLSearchParams({ status, limit: '200' });
        if (cursor) query.set('cursor', cursor);
        const page = (await (await call(`/admin/reports?${query}`)).json()) as {
          reports: AdminReport[];
          next: string | null;
        };
        reports.push(...page.reports);
        cursor = page.next;
      } while (cursor);
      return reports;
    },

    /** Sets the same fields on every id, 200 at a time. Answers the count changed. */
    async patchReports(ids: readonly string[], patch: ReportPatch): Promise<number> {
      let updated = 0;
      for (let i = 0; i < ids.length; i += PATCH_LIMIT) {
        const res = await call('/admin/reports', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: ids.slice(i, i + PATCH_LIMIT), ...patch }),
        });
        updated += ((await res.json()) as { updated: number }).updated;
      }
      return updated;
    },

    async capture(id: string): Promise<{ bytes: Uint8Array; contentType: string }> {
      const res = await call(`/admin/captures/${encodeURIComponent(id)}`);
      return {
        bytes: new Uint8Array(await res.arrayBuffer()),
        contentType: res.headers.get('Content-Type') ?? 'application/octet-stream',
      };
    },

    async captureLink(id: string): Promise<{ url: string; expiresAt: string }> {
      const res = await call(`/admin/captures/${encodeURIComponent(id)}?link=1`);
      return (await res.json()) as { url: string; expiresAt: string };
    },
  };
}

export type FeedbackApi = ReturnType<typeof feedbackApi>;
