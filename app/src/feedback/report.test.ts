import {
  CONTENT_SCHEMA_VERSION,
  ContentBundleSchema,
  GAMES,
  ReportSchema,
  type ChildProfile,
  type ContentBundle,
  type GameKind,
} from '@bright-trail/shared';
import { buildReport, type ReportInput } from './report';

type Fs = { readFileSync(path: string, encoding: 'utf8'): string };
declare const __dirname: string;

// The full bundle, so every game kind has a real item, including subjects not offered yet.
const bundle: ContentBundle = ContentBundleSchema.parse(
  JSON.parse(
    jest
      .requireActual<Fs>('node:fs')
      .readFileSync(`${__dirname}/../../../content/out/bundle.json`, 'utf8'),
  ),
);

const child: ChildProfile = {
  id: 'child-zephyrine-41c7',
  firstName: 'Zephyrine',
  birthdate: '2019-04-23',
  avatar: 'fox',
  readingMode: true,
  dyslexicFont: false,
  subjects: ['math'],
};

const input = (overrides: Partial<ReportInput> = {}): ReportInput => ({
  id: '6f1c2b1e-3a4d-4c55-9a0e-2f3b4c5d6e7f',
  createdAt: '2026-11-16T14:30:00Z',
  target: { kind: 'item', item: bundle.items[0] },
  phase: 'check',
  bundle,
  coreHash: 'a'.repeat(64),
  app: { appVersion: '3.0.0', runtimeVersion: '3', updateId: null },
  device: { platform: 'android', osVersion: '15', model: 'Samsung SM-X200' },
  screen: { width: 800, height: 1280, scale: 2, fontScale: 1.15 },
  child,
  hasCapture: true,
  ...overrides,
});

const expectNoChild = (report: unknown) => {
  const json = JSON.stringify(report);
  for (const secret of [child.id, child.firstName, child.birthdate]) {
    expect(json).not.toContain(secret);
  }
};

describe('buildReport', () => {
  const kinds = Object.keys(GAMES) as GameKind[];

  it.each(kinds)('reports a %s item with no child name or id', (kind) => {
    const item = bundle.items.find((i) => i.game?.kind === kind);
    if (!item) throw new Error(`The bundle has no ${kind} item`);
    const report = buildReport(input({ target: { kind: 'item', item } }));

    expect(ReportSchema.safeParse(report).success).toBe(true);
    expect(report.item).toEqual(item);
    expect(report.target).toEqual({ contentKind: 'item', contentId: item.id, cardIndex: null });
    expect(report.skillId).toBe(item.skillId);
    expectNoChild(report);
  });

  it('copies the content, app, device, screen, and reading settings', () => {
    const report = buildReport(input());
    expect(report).toMatchObject({
      phase: 'check',
      content: {
        bundleVersion: bundle.version,
        coreHash: 'a'.repeat(64),
        contentSchemaVersion: CONTENT_SCHEMA_VERSION,
      },
      app: { appVersion: '3.0.0', runtimeVersion: '3', updateId: null },
      device: { platform: 'android', osVersion: '15', model: 'Samsung SM-X200' },
      screen: { width: 800, height: 1280, scale: 2, fontScale: 1.15 },
      settings: { readingMode: true, dyslexicFont: false },
      hasCapture: true,
    });
  });

  it('reports a story card by its nugget and index, with no item', () => {
    const nugget = bundle.nuggets[0];
    const report = buildReport(
      input({ target: { kind: 'card', nugget, cardIndex: 2 }, phase: 'review' }),
    );
    expect(report.target).toEqual({ contentKind: 'card', contentId: nugget.id, cardIndex: 2 });
    expect(report.item).toBeNull();
    expect(report.skillId).toBe(nugget.skillId);
    expectNoChild(report);
    expect(() =>
      buildReport(input({ target: { kind: 'card', nugget, cardIndex: nugget.cards.length } })),
    ).toThrow(/no card/);
  });

  it('trims the comment and turns a blank one into null', () => {
    expect(buildReport(input({ comment: '  The towers are wrong. ' })).comment).toBe(
      'The towers are wrong.',
    );
    expect(buildReport(input({ comment: '   \n ' })).comment).toBeNull();
    expect(buildReport(input({ comment: '' })).comment).toBeNull();
    expect(buildReport(input({ comment: null })).comment).toBeNull();
    expect(buildReport(input()).comment).toBeNull();
  });

  it('cuts a long comment to the limit', () => {
    expect(buildReport(input({ comment: 'x'.repeat(600) })).comment).toHaveLength(500);
  });

  it('throws on a report the schema refuses', () => {
    expect(() => buildReport(input({ id: 'not-a-uuid' }))).toThrow();
  });
});
