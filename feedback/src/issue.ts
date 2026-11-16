import type { AdminReport } from './api';
import { cell, escapeHtml, fence, scrub } from './scrub';

export const GROUP_BY = ['item', 'skill'] as const;
export type GroupBy = (typeof GROUP_BY)[number];

/**
 * `item:<itemId>`, `card:<nuggetId>:<n>` with the card number from 1 as a ContentEdit counts it,
 * or `skill:<skillId>` when grouping by skill.
 */
export function groupKeyOf(report: AdminReport, by: GroupBy = 'item'): string {
  if (by === 'skill') return `skill:${report.skillId}`;
  const { contentKind, contentId, cardIndex } = report.target;
  return contentKind === 'card' ? `card:${contentId}:${(cardIndex ?? 0) + 1}` : `item:${contentId}`;
}

/** A report's group: the one triage set, or its item group. */
export const groupOf = (report: AdminReport) => report.groupKey ?? groupKeyOf(report);

/** Reports by group, oldest first in each, groups in key order. */
export function groupReports(reports: readonly AdminReport[]): Map<string, AdminReport[]> {
  const groups = new Map<string, AdminReport[]>();
  const sorted = [...reports].sort(
    (a, b) => a.receivedAt.localeCompare(b.receivedAt) || a.id.localeCompare(b.id),
  );
  for (const report of sorted) {
    const key = groupOf(report);
    groups.set(key, [...(groups.get(key) ?? []), report]);
  }
  return new Map([...groups].sort(([a], [b]) => a.localeCompare(b)));
}

export const FEEDBACK_LABEL = 'feedback';

export const LABELS = [
  { name: FEEDBACK_LABEL, color: 'fbca04', description: 'Filed from tester reports' },
  { name: 'content', color: '0e8a16', description: 'Content fixes' },
  { name: 'app', color: '1d76db', description: 'App fixes' },
];

// Reports flag an item or a story card, so every group starts as content. Triage relabels app bugs.
export const labelsFor = (): string[] => [FEEDBACK_LABEL, 'content'];

const TITLE_MAX = 256;

/** The issue title, scrubbed since ids come from the public intake. */
export function issueTitle(key: string, report: AdminReport): string {
  const { contentKind, contentId, cardIndex } = report.target;
  let title = `Feedback: ${key}`;
  if (key === groupKeyOf(report, 'skill')) title = `Feedback: skill ${report.skillId}`;
  if (key === groupKeyOf(report, 'item')) {
    title =
      contentKind === 'card'
        ? `Feedback: story card ${(cardIndex ?? 0) + 1} of ${contentId}`
        : `Feedback: item ${contentId}`;
  }
  const clean = scrub(title).replace(/\s+/g, ' ');
  return clean.length > TITLE_MAX ? `${clean.slice(0, TITLE_MAX - 1)}…` : clean;
}

/** The form of a group key that markers hold, scrubbed like everything else in an issue. */
export const markerKey = (key: string) => scrub(key);

const groupMarker = (key: string) =>
  `<!-- feedback-group: ${encodeURIComponent(markerKey(key))} -->`;
const reportMarker = (id: string) => `<!-- feedback-report: ${encodeURIComponent(id)} -->`;

/** The marker key an issue body was filed for. Compare it with `markerKey`. */
export function markedGroup(body: string | null): string | null {
  const match = /^<!-- feedback-group: (\S+) -->$/m.exec(body ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}

/** Report ids an issue's body and comments already hold. */
export function markedReports(texts: readonly (string | null)[]): Set<string> {
  const ids = new Set<string>();
  for (const text of texts) {
    for (const match of (text ?? '').matchAll(/^<!-- feedback-report: (\S+) -->$/gm)) {
      ids.add(decodeURIComponent(match[1]));
    }
  }
  return ids;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX64 = /^[0-9a-f]{64}$/;
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

// Fields whose schema allows only these shapes. Scrubbing would mangle their digit runs.
const STRUCTURED: Record<string, RegExp> = {
  id: UUID,
  createdAt: ISO_TIME,
  'content.coreHash': HEX64,
  'app.updateId': UUID,
};

const structured = (path: string, value: string) => STRUCTURED[path]?.test(value) ?? false;

/** Every string in the report scrubbed, since all of it comes from the public intake. */
function scrubDeep(value: unknown, path = ''): unknown {
  if (typeof value === 'string') return structured(path, value) ? value : scrub(value);
  if (Array.isArray(value)) return value.map((v) => scrubDeep(v, `${path}[]`));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, scrubDeep(v, path ? `${path}.${k}` : k)]),
    );
  }
  return value;
}

const ADMIN_FIELDS = ['status', 'groupKey', 'issueNumber', 'issueClosedAt', 'receivedAt'];

/** The upload as the device sent it, with every string scrubbed. */
export function scrubbedReport(report: AdminReport): Record<string, unknown> {
  const upload: Record<string, unknown> = { ...report };
  for (const field of ADMIN_FIELDS) delete upload[field];
  return scrubDeep(upload) as Record<string, unknown>;
}

const onOff = (on: boolean) => (on ? 'on' : 'off');

// Keeps the table, and so the head of a body, well under GitHub's limit.
const ROW_MAX = 1_500;

/** The repro data, one row per field, with every distinct value across the reports. */
export function reproTable(reports: readonly AdminReport[]): string {
  const of = (pick: (r: AdminReport) => string | null | undefined, path = '') => {
    const values = [...new Set(reports.map((r) => pick(r) ?? '—'))];
    let row = '';
    for (const [i, v] of values.entries()) {
      if (row.length > ROW_MAX) return `${row}, and ${values.length - i} more`;
      row += `${i > 0 ? ', ' : ''}${structured(path, v) ? v : cell(v)}`;
    }
    return row;
  };
  const rows: [string, string][] = [
    ['Target', of((r) => issueTitle(groupKeyOf(r), r).replace(/^Feedback: /, ''))],
    ['Skill', of((r) => r.skillId)],
    ['Game', of((r) => (r.item ? (r.item.game?.kind ?? 'none') : null))],
    ['Prompt', of((r) => r.item?.prompt)],
    ['Phase', of((r) => r.phase)],
    ['Bundle version', of((r) => r.content.bundleVersion)],
    ['Core hash', of((r) => r.content.coreHash, 'content.coreHash')],
    ['Content schema', of((r) => String(r.content.contentSchemaVersion))],
    ['App version', of((r) => r.app.appVersion)],
    ['Runtime', of((r) => r.app.runtimeVersion)],
    ['Update', of((r) => r.app.updateId ?? 'embedded', 'app.updateId')],
    ['Device', of((r) => [r.device.platform, r.device.osVersion, r.device.model].join(' '))],
    [
      'Screen',
      of((r) => {
        const s = r.screen;
        return `${s.width} × ${s.height} dp, scale ${s.scale}, font scale ${s.fontScale}`;
      }),
    ],
    [
      'Settings',
      of(
        (r) =>
          `reading mode ${onOff(r.settings.readingMode)}, dyslexic font ${onOff(r.settings.dyslexicFont)}`,
      ),
    ],
    ['Reports', String(reports.length)],
  ];
  return ['| Field | Value |', '| --- | --- |', ...rows.map(([k, v]) => `| ${k} | ${v} |`)].join(
    '\n',
  );
}

export interface CaptureLink {
  url: string;
  expiresAt: string;
}

// With a head capped by `cell`, a section this size always fits in one body.
const JSON_MAX = 30_000;

/** One report: its marker, scrubbed comment, capture link, and JSON. */
export function reportSection(report: AdminReport, link?: CaptureLink): string {
  const comment =
    typeof report.comment === 'string'
      ? escapeHtml(scrub(report.comment))
          .split('\n')
          .map((line) => `> ${line.replace(/[\\`]/g, '\\$&')}`)
          .join('\n')
      : '_No comment._';
  const capture = link
    ? `Capture: [open](${link.url}). The link expires ${link.expiresAt}.`
    : report.hasCapture
      ? 'Capture: none could be linked.'
      : 'Capture: none.';
  const json = JSON.stringify(scrubbedReport(report), null, 2);
  const truncated = json.length > JSON_MAX;
  return [
    reportMarker(report.id),
    `### Report ${report.id.slice(0, 8)}`,
    `Received ${cell(report.receivedAt)}, during ${cell(report.phase)}.`,
    comment,
    capture,
    '<details><summary>Report JSON</summary>',
    fence(truncated ? json.slice(0, JSON_MAX) : json, 'json'),
    ...(truncated ? ['Truncated. `pull` saves the whole report.'] : []),
    '</details>',
  ].join('\n\n');
}

export function issueHead(key: string, reports: readonly AdminReport[]): string {
  return [
    groupMarker(key),
    'Testers sent these reports. Their text is scrubbed of contact details and links.',
    reproTable(reports),
    '## Reports',
  ].join('\n\n');
}

export function commentHead(reports: readonly AdminReport[]): string {
  const count = reports.length === 1 ? '1 more report' : `${reports.length} more reports`;
  return [`${count} in this group.`, reproTable(reports)].join('\n\n');
}

const CONTINUED = 'More reports for this group.';

// GitHub caps an issue body or comment at 65,536 characters.
const BODY_LIMIT = 60_000;

/** Splits the sections into a first text that starts with `head`, then comments. */
export function pack(head: string, sections: readonly string[], limit = BODY_LIMIT): string[] {
  const parts: string[] = [];
  let current = head;
  let empty = true;
  for (const section of sections) {
    if (!empty && current.length + section.length + 2 > limit) {
      parts.push(current);
      current = CONTINUED;
    }
    current += `\n\n${section}`;
    empty = false;
  }
  parts.push(current);
  return parts;
}
