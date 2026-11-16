import type { ChildProfile } from '@bright-trail/shared';
import { loadCore } from '../content/core';
import { bundle } from '../learning/testing';
import { openRepository, type Repository } from '../storage/repository';
import { openNodeSqliteDatabase } from '../storage/testing/nodeSqliteDatabase';
import { queueReport, type QueueDeps } from './queue';

const ID = '6f1c2b1e-3a4d-4c55-9a0e-2f3b4c5d6e7f';
const child: ChildProfile = {
  id: 'maya',
  firstName: 'Maya',
  birthdate: '2020-03-14',
  avatar: 'fox',
  readingMode: true,
  dyslexicFont: false,
  subjects: ['math'],
};
const item = bundle.items[0];

function deps(): QueueDeps & { kept: string[][] } {
  const kept: string[][] = [];
  return {
    kept,
    files: {
      keep: async (uri, name) => {
        kept.push([uri, name]);
        return `file:///docs/reports/${name}`;
      },
      remove: () => undefined,
    },
    id: () => ID,
    now: () => new Date('2026-11-16T14:30:00Z'),
    context: () => ({
      app: { appVersion: '3.0.0', runtimeVersion: '3', updateId: null },
      device: { platform: 'android', osVersion: '15', model: 'Samsung SM-X200' },
      screen: { width: 800, height: 1280, scale: 2, fontScale: 1 },
    }),
  };
}

describe('queueReport', () => {
  let repo: Repository;

  beforeEach(async () => {
    repo = await openRepository(openNodeSqliteDatabase(':memory:'));
    await repo.children.save(child);
  });

  it('keeps the capture under the report id and queues the report with it', async () => {
    const d = deps();
    const draft = {
      target: { kind: 'item' as const, item },
      phase: 'check' as const,
      childId: child.id,
      capturePath: 'file:///cache/shot.jpg',
    };
    await queueReport(repo, draft, ' Wrong towers ', d);

    expect(d.kept).toEqual([['file:///cache/shot.jpg', `${ID}.jpg`]]);
    const [queued] = await repo.reports.listPending();
    expect(queued.capturePath).toBe(`file:///docs/reports/${ID}.jpg`);
    expect(queued.report).toMatchObject({
      id: ID,
      comment: 'Wrong towers',
      item,
      phase: 'check',
      content: { coreHash: loadCore().hash },
      settings: { readingMode: true, dyslexicFont: false },
      hasCapture: true,
    });
  });

  it('queues a report without a capture when there is none', async () => {
    const draft = {
      target: { kind: 'item' as const, item },
      phase: 'review' as const,
      childId: child.id,
      capturePath: null,
    };
    await queueReport(repo, draft, '', deps());

    const [queued] = await repo.reports.listPending();
    expect(queued.capturePath).toBeNull();
    expect(queued.report).toMatchObject({ comment: null, hasCapture: false });
  });
});
