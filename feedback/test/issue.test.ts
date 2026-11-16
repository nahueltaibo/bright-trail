import { describe, expect, it } from 'vitest';
import { sampleReport } from '../../feedback-worker/test/helpers';
import type { AdminReport } from '../src/api';
import { issueHead, issueTitle, pack, reportSection } from '../src/issue';

const admin = (overrides: Record<string, unknown> = {}) =>
  ({
    ...sampleReport(overrides),
    status: 'new',
    groupKey: null,
    issueNumber: null,
    issueClosedAt: null,
    receivedAt: '2026-11-16T14:31:00.000Z',
  }) as unknown as AdminReport;

describe('issue text', () => {
  it('caps the title at 256 characters', () => {
    const id = 'a'.repeat(400);
    const report = admin({ target: { contentKind: 'item', contentId: id, cardIndex: null } });
    expect(issueTitle(`item:${id}`, report)).toHaveLength(256);
  });

  it('keeps every part under the GitHub limit, however big the reports', () => {
    const model = 'x'.repeat(50_000);
    const reports = Array.from({ length: 30 }, (_, i) =>
      admin({ device: { platform: 'android', osVersion: `v${i}`, model } }),
    );
    const parts = pack(
      issueHead('item:a', reports),
      reports.map((r) => reportSection(r)),
    );
    for (const part of parts) expect(part.length).toBeLessThan(65_536);
    expect(parts[0]).toContain('Truncated.');
  });
});
