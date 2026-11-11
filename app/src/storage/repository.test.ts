import type { Attempt, ChildProfile, MasteryState, PlacementState } from '@bright-trail/shared';
import type { SqlDatabase } from './db';
import type { ContentFlag } from './flag';
import { openRepository, type Repository } from './repository';
import { makeTempDatabasePath, openNodeSqliteDatabase } from './testing/nodeSqliteDatabase';

const maya: ChildProfile = {
  id: 'maya',
  firstName: 'Maya',
  birthdate: '2020-03-14',
  avatar: 'fox',
  readingMode: false,
  dyslexicFont: false,
  subjects: ['math'],
};
const leo: ChildProfile = {
  id: 'leo',
  firstName: 'Leo',
  birthdate: '2016-07-02',
  gradeOverride: '5',
  avatar: 'owl',
  readingMode: true,
  dyslexicFont: true,
  subjects: ['math'],
};

const masteryState: MasteryState = {
  childId: 'maya',
  skillId: 'g1-add-within-10',
  status: 'learning',
  checkAnswered: 3,
  checkCorrect: 2,
  failedChecks: 1,
  reviewsPassed: 0,
  nextReviewOn: null,
  updatedAt: '2026-11-06T14:30:00Z',
};

const attempt = (overrides: Partial<Attempt> = {}): Attempt => ({
  childId: 'maya',
  skillId: 'g1-add-within-10',
  itemId: 'g1-add-within-10-item-1',
  answer: 7,
  correct: true,
  timeToAnswerMs: 4200,
  narrationReplays: 1,
  sessionId: 'session-1',
  phase: 'check',
  timestamp: '2026-11-06T14:31:00Z',
  ...overrides,
});

const cardFlag: ContentFlag = {
  childId: 'maya',
  contentKind: 'card',
  contentId: 'k-count-to-20-story',
  cardIndex: 2,
  bundleVersion: 'sample-1',
  createdAt: '2026-11-06T14:32:00Z',
};

describe('repository', () => {
  let db: SqlDatabase;
  let repo: Repository;

  beforeEach(async () => {
    db = openNodeSqliteDatabase(':memory:');
    repo = await openRepository(db);
  });

  describe('children', () => {
    it('saves and lists profiles in the order they were added', async () => {
      await repo.children.save(leo);
      await repo.children.save(maya);
      expect(await repo.children.list()).toEqual([leo, maya]);
      expect(await repo.children.get('maya')).toEqual(maya);
      expect(await repo.children.get('nobody')).toBeNull();
    });

    it('updates a profile in place without moving it in the list', async () => {
      await repo.children.save(maya);
      await repo.children.save(leo);
      await repo.children.save({ ...maya, readingMode: true, gradeOverride: '1' });
      expect(await repo.children.list()).toEqual([
        { ...maya, readingMode: true, gradeOverride: '1' },
        leo,
      ]);
    });

    it('rejects an invalid profile before writing it', async () => {
      await expect(repo.children.save({ ...maya, id: 'Not Kebab' })).rejects.toThrow();
      await expect(repo.children.save({ ...maya, birthdate: '14/03/2020' })).rejects.toThrow();
      expect(await repo.children.list()).toEqual([]);
    });

    it('rejects a corrupt row on read', async () => {
      await db.runAsync(
        "INSERT INTO children (id, first_name, birthdate, grade_override, avatar, reading_mode) VALUES ('maya', 'Maya', 'not-a-date', NULL, 'fox', 0)",
        [],
      );
      await expect(repo.children.list()).rejects.toThrow();
    });

    it('removes a child with their mastery and attempts, and keeps their flags', async () => {
      await repo.children.save(maya);
      await repo.mastery.save(masteryState);
      await repo.attempts.add(attempt());
      await repo.flags.add(cardFlag);

      await repo.children.remove('maya');

      expect(await repo.children.list()).toEqual([]);
      expect(await repo.mastery.listForChild('maya')).toEqual([]);
      expect(await repo.attempts.listAll()).toEqual([]);
      expect((await repo.flags.list()).map((f) => f.childId)).toEqual([null]);
    });
  });

  describe('mastery', () => {
    beforeEach(() => repo.children.save(maya));

    it('saves, replaces, and reads one row per child and skill', async () => {
      await repo.mastery.save(masteryState);
      const mastered: MasteryState = {
        ...masteryState,
        status: 'mastered',
        checkAnswered: 5,
        checkCorrect: 4,
        nextReviewOn: '2026-11-08',
      };
      await repo.mastery.save(mastered);
      expect(await repo.mastery.listForChild('maya')).toEqual([mastered]);
      expect(await repo.mastery.get('maya', 'g1-add-within-10')).toEqual(mastered);
      expect(await repo.mastery.get('maya', 'k-count-to-20')).toBeNull();
    });

    it('rejects a state that breaks the schema', async () => {
      await expect(
        repo.mastery.save({ ...masteryState, checkAnswered: 2, checkCorrect: 3 }),
      ).rejects.toThrow(/checkCorrect/);
    });

    it('rejects a state for a child that does not exist', async () => {
      await expect(repo.mastery.save({ ...masteryState, childId: 'nobody' })).rejects.toThrow(
        /FOREIGN KEY/,
      );
    });

    it('resets a child without touching their attempts', async () => {
      await repo.mastery.save(masteryState);
      await repo.attempts.add(attempt());
      await repo.mastery.removeForChild('maya');
      expect(await repo.mastery.listForChild('maya')).toEqual([]);
      expect(await repo.attempts.listForChild('maya')).toHaveLength(1);
    });
  });

  describe('walkBack', () => {
    beforeEach(() => repo.children.save(maya));

    it('stores, replaces, and clears a child walk-back', async () => {
      expect(await repo.walkBack.get('maya')).toBeNull();
      await repo.walkBack.save('maya', {
        probes: ['k-count-to-20'],
        targets: ['g1-add-within-10'],
      });
      await repo.walkBack.save('maya', { probes: [], targets: ['g1-add-within-10'] });
      expect(await repo.walkBack.get('maya')).toEqual({
        probes: [],
        targets: ['g1-add-within-10'],
      });
      await repo.walkBack.save('maya', null);
      expect(await repo.walkBack.get('maya')).toBeNull();
    });

    it('survives a profile edit', async () => {
      await repo.walkBack.save('maya', { probes: ['k-count-to-20'], targets: [] });
      await repo.children.save({ ...maya, readingMode: true });
      expect(await repo.walkBack.get('maya')).toEqual({ probes: ['k-count-to-20'], targets: [] });
    });

    it('is cleared when progress is reset', async () => {
      await repo.walkBack.save('maya', { probes: ['k-count-to-20'], targets: [] });
      await repo.mastery.removeForChild('maya');
      expect(await repo.walkBack.get('maya')).toBeNull();
    });

    it('rejects bad ids and unknown children', async () => {
      await expect(
        repo.walkBack.save('maya', { probes: ['Bad Id'], targets: [] }),
      ).rejects.toThrow();
      await expect(repo.walkBack.save('nobody', { probes: [], targets: [] })).rejects.toThrow(
        /No child/,
      );
    });
  });

  describe('placement', () => {
    beforeEach(() => repo.children.save(maya));

    const state: PlacementState = {
      childId: 'maya',
      phase: 'search',
      low: 0,
      high: 2,
      direction: null,
      grade: 1,
      gradeSize: 2,
      gradePassed: 0,
      gradeFailed: 0,
      queue: ['g1-add-within-10'],
      current: {
        skillId: 'g1-numbers-to-50',
        itemId: 'g1-numbers-to-50-keypad-1',
        answered: 0,
        correct: 0,
      },
      results: [],
      grades: [],
      usedItemIds: ['g1-numbers-to-50-keypad-1'],
      itemsAnswered: 0,
      placedRank: null,
      waitingFor: null,
    };

    it('stores placement in progress, then the finished outcome', async () => {
      expect(await repo.placement.get('maya')).toBeNull();
      await repo.placement.save('maya', { state, placedGrade: null, finishedAt: null });
      expect(await repo.placement.get('maya')).toEqual({
        state,
        placedGrade: null,
        finishedAt: null,
      });
      const done = { ...state, phase: 'done' as const, current: null, placedRank: 1 };
      await repo.placement.save('maya', {
        state: done,
        placedGrade: '1',
        finishedAt: '2026-11-06T14:40:00Z',
      });
      expect(await repo.placement.get('maya')).toEqual({
        state: done,
        placedGrade: '1',
        finishedAt: '2026-11-06T14:40:00Z',
      });
    });

    it('is cleared by a progress reset and by deleting the child', async () => {
      await repo.placement.save('maya', { state, placedGrade: null, finishedAt: null });
      await repo.mastery.removeForChild('maya');
      expect(await repo.placement.get('maya')).toBeNull();
      await repo.placement.save('maya', { state, placedGrade: null, finishedAt: null });
      await repo.children.remove('maya');
      expect(await repo.placement.get('maya')).toBeNull();
    });

    it('rejects a state for another child or a bad grade', async () => {
      await expect(
        repo.placement.save('leo', { state, placedGrade: null, finishedAt: null }),
      ).rejects.toThrow(/maya/);
      await expect(
        repo.placement.save('maya', {
          state,
          placedGrade: '9' as never,
          finishedAt: null,
        }),
      ).rejects.toThrow();
    });
  });

  describe('attempts', () => {
    beforeEach(async () => {
      await repo.children.save(maya);
      await repo.children.save(leo);
    });

    it('keeps number and string answers as they were given', async () => {
      const tap = attempt({ answer: 'choice-b', correct: false, phase: 'placement' });
      const keypad = attempt({ answer: 7 });
      const numeric = attempt({ answer: '7' });
      await repo.attempts.add(tap);
      await repo.attempts.add(keypad);
      await repo.attempts.add(numeric);
      expect(await repo.attempts.listForChild('maya')).toEqual([tap, keypad, numeric]);
    });

    it('lists every child in answer order as flat, JSON-ready rows', async () => {
      const first = attempt();
      const second = attempt({ childId: 'leo', sessionId: 'session-2' });
      await repo.attempts.add(first);
      await repo.attempts.add(second);

      const all = await repo.attempts.listAll();
      expect(all).toEqual([first, second]);
      expect(JSON.parse(JSON.stringify(all))).toEqual([first, second]);
      expect(await repo.attempts.listForChild('leo')).toEqual([second]);
    });

    it('rejects an invalid attempt', async () => {
      await expect(repo.attempts.add(attempt({ timeToAnswerMs: -1 }))).rejects.toThrow();
      await expect(repo.attempts.add(attempt({ timestamp: '2026-11-06 14:31' }))).rejects.toThrow();
      expect(await repo.attempts.listAll()).toEqual([]);
    });
  });

  describe('flags', () => {
    it('stores card and item flags, newest first', async () => {
      await repo.children.save(maya);
      const itemFlag: ContentFlag = {
        childId: null,
        contentKind: 'item',
        contentId: 'g1-add-within-10-item-3',
        cardIndex: null,
        bundleVersion: 'sample-1',
        createdAt: '2026-11-06T15:00:00Z',
      };
      await repo.flags.add(cardFlag);
      await repo.flags.add(itemFlag);

      const flags = await repo.flags.list();
      expect(flags.map(({ id, ...flag }) => flag)).toEqual([
        { ...itemFlag, resolvedAt: null },
        { ...cardFlag, resolvedAt: null },
      ]);

      await repo.flags.remove(flags[0].id);
      expect((await repo.flags.list()).map((f) => f.contentKind)).toEqual(['card']);
    });

    it('resolves a flag without deleting it, and can reopen it', async () => {
      await repo.children.save(maya);
      await repo.flags.add(cardFlag);
      const [{ id }] = await repo.flags.list();

      await repo.flags.resolve(id, '2026-11-07T09:00:00Z');
      expect(await repo.flags.list()).toEqual([
        { id, ...cardFlag, resolvedAt: '2026-11-07T09:00:00Z' },
      ]);
      expect(await repo.flags.list({ includeResolved: false })).toEqual([]);

      await repo.flags.reopen(id);
      expect(await repo.flags.list({ includeResolved: false })).toEqual([
        { id, ...cardFlag, resolvedAt: null },
      ]);
    });

    it('rejects a resolve time that is not an ISO date-time', async () => {
      await repo.children.save(maya);
      await repo.flags.add(cardFlag);
      const [{ id }] = await repo.flags.list();
      await expect(repo.flags.resolve(id, 'yesterday')).rejects.toThrow();
    });

    it('requires a card index for cards only', async () => {
      await expect(repo.flags.add({ ...cardFlag, cardIndex: null })).rejects.toThrow(/cardIndex/);
      await expect(
        repo.flags.add({ ...cardFlag, contentKind: 'item', childId: null }),
      ).rejects.toThrow(/cardIndex/);
    });
  });
});

describe('settings', () => {
  it('stores, replaces, and removes a value by key', async () => {
    const repo = await openRepository(openNodeSqliteDatabase(':memory:'));
    expect(await repo.settings.get('pin')).toBeNull();
    await repo.settings.set('pin', 'a');
    await repo.settings.set('pin', 'b');
    expect(await repo.settings.get('pin')).toBe('b');
    await repo.settings.remove('pin');
    expect(await repo.settings.get('pin')).toBeNull();
  });
});

describe('storage across an app restart', () => {
  it('keeps profiles, mastery, walk-back, attempts, and flags after the database is reopened', async () => {
    const { path, cleanup } = makeTempDatabasePath();
    try {
      const firstDb = openNodeSqliteDatabase(path);
      const first = await openRepository(firstDb);
      await first.children.save(maya);
      await first.children.save(leo);
      await first.mastery.save(masteryState);
      await first.attempts.add(attempt());
      await first.attempts.add(attempt({ childId: 'leo', answer: 'choice-a' }));
      await first.flags.add(cardFlag);
      await first.walkBack.save('maya', {
        probes: ['k-count-to-20'],
        targets: ['g1-add-within-10'],
      });
      await firstDb.closeAsync();

      const secondDb = openNodeSqliteDatabase(path);
      const second = await openRepository(secondDb);
      expect(await second.children.list()).toEqual([maya, leo]);
      expect(await second.mastery.listForChild('maya')).toEqual([masteryState]);
      expect(await second.attempts.listAll()).toEqual([
        attempt(),
        attempt({ childId: 'leo', answer: 'choice-a' }),
      ]);
      expect(await second.flags.list()).toEqual([{ id: 1, ...cardFlag, resolvedAt: null }]);
      expect(await second.walkBack.get('maya')).toEqual({
        probes: ['k-count-to-20'],
        targets: ['g1-add-within-10'],
      });
      await secondDb.closeAsync();
    } finally {
      cleanup();
    }
  });
});
