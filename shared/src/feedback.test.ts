import { describe, expect, it } from 'vitest';
import { REPORT_COMMENT_MAX, ReportSchema } from './feedback';

const item = {
  id: 'k-more-less-same-keypad-3',
  skillId: 'k-more-less-same',
  type: 'keypad',
  difficulty: 2,
  narration: 'Which number is less, 7 or 2? Type the smaller number.',
  prompt: '7 or 2: less?',
  why: '2 comes before 7 when we count. So 2 is less than 7.',
  game: { kind: 'compare', ask: 'least', values: ['7', '2'] },
  answer: 2,
};

const report = {
  id: '6f1c2b1e-3a4d-4c55-9a0e-2f3b4c5d6e7f',
  createdAt: '2026-11-16T14:30:00Z',
  comment: 'The towers are the wrong height.',
  target: { contentKind: 'item', contentId: item.id, cardIndex: null },
  item,
  skillId: item.skillId,
  phase: 'check',
  content: {
    bundleVersion: '2026.11.16-1',
    coreHash: 'a'.repeat(64),
    contentSchemaVersion: 5,
  },
  app: {
    appVersion: '3.0.0',
    runtimeVersion: '3',
    updateId: '0f8e7d6c-5b4a-4321-8fed-cba987654321',
  },
  device: { platform: 'android', osVersion: '14', model: 'Samsung SM-X200' },
  screen: { width: 800, height: 1280, scale: 1.5, fontScale: 1 },
  settings: { readingMode: false, dyslexicFont: true },
  hasCapture: true,
};

const cardReport = {
  ...report,
  target: { contentKind: 'card', contentId: 'k-count-to-20-story', cardIndex: 2 },
  item: null,
  skillId: 'k-count-to-20',
  phase: 'review',
};

const ok = (data: unknown) => ReportSchema.safeParse(data).success;

describe('ReportSchema', () => {
  it('accepts an item report that survives a JSON round trip', () => {
    expect(ReportSchema.parse(JSON.parse(JSON.stringify(report)))).toEqual(report);
  });

  it('accepts a card report, and one with no comment, capture, or platform details', () => {
    expect(ok(cardReport)).toBe(true);
    expect(
      ok({
        ...report,
        comment: null,
        hasCapture: false,
        app: { appVersion: '3.0.0', runtimeVersion: null, updateId: null },
        device: { platform: 'web', osVersion: null, model: null },
      }),
    ).toBe(true);
  });

  it('rejects unknown fields at the top and inside each part', () => {
    expect(ok({ ...report, childId: 'mia' })).toBe(false);
    expect(ok({ ...report, device: { ...report.device, deviceId: 'abc' } })).toBe(false);
    expect(ok({ ...report, settings: { ...report.settings, firstName: 'Mia' } })).toBe(false);
  });

  it('requires every field, including hasCapture', () => {
    for (const key of Object.keys(report)) {
      const rest: Record<string, unknown> = { ...report };
      delete rest[key];
      expect(ok(rest), key).toBe(false);
    }
  });

  it(`limits the comment to ${REPORT_COMMENT_MAX} characters and rejects blank text`, () => {
    expect(ok({ ...report, comment: 'x'.repeat(REPORT_COMMENT_MAX) })).toBe(true);
    expect(ok({ ...report, comment: 'x'.repeat(REPORT_COMMENT_MAX + 1) })).toBe(false);
    expect(ok({ ...report, comment: '   ' })).toBe(false);
  });

  it('rejects a report id that is not a uuid', () => {
    expect(ok({ ...report, id: 'report-1' })).toBe(false);
  });

  it('ties the target to the item', () => {
    expect(ok({ ...report, item: null })).toBe(false);
    expect(ok({ ...report, target: { ...report.target, cardIndex: 0 } })).toBe(false);
    expect(ok({ ...report, target: { ...report.target, contentId: 'other-item' } })).toBe(false);
    expect(ok({ ...report, skillId: 'k-count-to-20' })).toBe(false);
    expect(ok({ ...cardReport, item })).toBe(false);
    expect(ok({ ...cardReport, target: { ...cardReport.target, cardIndex: null } })).toBe(false);
  });
});
