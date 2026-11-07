import type { Attempt, ChildProfile, MasteryState } from '@bright-trail/shared';
import { openRepository } from '../storage/repository';
import { openNodeSqliteDatabase } from '../storage/testing/nodeSqliteDatabase';
import { EXPORT_FORMAT, EXPORT_VERSION, buildExport, exportFileName } from './exportData';

const maya: ChildProfile = {
  id: 'maya',
  firstName: 'Maya',
  birthdate: '2020-03-14',
  avatar: 'fox',
  readingMode: false,
};
const leo: ChildProfile = {
  id: 'leo',
  firstName: 'Leo',
  birthdate: '2016-07-02',
  gradeOverride: '6',
  avatar: 'owl',
  readingMode: true,
};
const mastery: MasteryState = {
  childId: 'maya',
  skillId: 'k-count-to-20',
  status: 'mastered',
  checkAnswered: 5,
  checkCorrect: 5,
  failedChecks: 0,
  reviewsPassed: 0,
  nextReviewOn: '2026-11-08',
  updatedAt: '2026-11-06T14:30:00Z',
};
const attempt = (childId: string, n: number): Attempt => ({
  childId,
  skillId: 'k-count-to-20',
  itemId: `k-count-to-20-item-${n}`,
  answer: n % 2 ? n : `choice-${n}`,
  correct: n % 2 === 1,
  timeToAnswerMs: 1000 * n,
  narrationReplays: 0,
  sessionId: 'session-1',
  phase: 'placement',
  timestamp: `2026-11-06T14:3${n}:00Z`,
});

describe('buildExport', () => {
  it('collects every child, mastery row, attempt, and flag into one JSON-ready payload', async () => {
    const repo = await openRepository(openNodeSqliteDatabase(':memory:'));
    await repo.children.save(maya);
    await repo.children.save(leo);
    await repo.mastery.save(mastery);
    await repo.walkBack.save('leo', { probes: ['k-count-to-20'], targets: [] });
    await repo.attempts.add(attempt('maya', 1));
    await repo.attempts.add(attempt('leo', 2));
    await repo.attempts.add(attempt('maya', 3));
    await repo.flags.add({
      childId: 'maya',
      contentKind: 'item',
      contentId: 'k-count-to-20-item-1',
      cardIndex: null,
      bundleVersion: 'sample-1',
      createdAt: '2026-11-06T14:40:00Z',
    });

    const payload = await buildExport(repo, {
      now: '2026-11-06T15:00:00-05:00',
      today: '2026-11-06',
      bundleVersion: 'sample-1',
    });

    expect(payload).toEqual({
      format: EXPORT_FORMAT,
      version: EXPORT_VERSION,
      exportedAt: '2026-11-06T15:00:00-05:00',
      bundleVersion: 'sample-1',
      children: [
        { ...maya, derivedGrade: '1', walkBack: null, placement: null },
        {
          ...leo,
          derivedGrade: '5',
          walkBack: { probes: ['k-count-to-20'], targets: [] },
          placement: null,
        },
      ],
      mastery: [mastery],
      attempts: [attempt('maya', 1), attempt('leo', 2), attempt('maya', 3)],
      flags: [
        expect.objectContaining({ id: 1, contentId: 'k-count-to-20-item-1', resolvedAt: null }),
      ],
    });
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload);
  });

  it('exports an empty device as empty lists', async () => {
    const repo = await openRepository(openNodeSqliteDatabase(':memory:'));
    const payload = await buildExport(repo, {
      now: '2026-11-06T15:00:00Z',
      today: '2026-11-06',
      bundleVersion: 'sample-1',
    });
    expect(payload).toMatchObject({ children: [], mastery: [], attempts: [], flags: [] });
  });
});

describe('exportFileName', () => {
  it('names the file by the local time, without colons', () => {
    expect(exportFileName('2026-11-06T15:04:05-05:00')).toBe(
      'bright-trail-export-2026-11-06T15-04-05.json',
    );
  });
});
