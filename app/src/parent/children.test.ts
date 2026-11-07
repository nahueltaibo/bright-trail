import type { Attempt, MasteryState } from '@bright-trail/shared';
import { openRepository, type Repository } from '../storage/repository';
import { openNodeSqliteDatabase } from '../storage/testing/nodeSqliteDatabase';
import {
  draftFromChild,
  effectiveGrade,
  emptyDraft,
  newChildId,
  saveChild,
  type ChildDraft,
} from './children';

const TODAY = '2026-11-06';

const draft = (overrides: Partial<ChildDraft> = {}): ChildDraft => ({
  firstName: 'Maya',
  birthdate: '2020-03-14',
  avatar: 'fox',
  gradeOverride: null,
  readingMode: false,
  ...overrides,
});

describe('newChildId', () => {
  it('makes a kebab-case id from the name with a random suffix', () => {
    expect(newChildId('Maya', [], () => 0.5)).toBe('maya-i000');
    expect(newChildId('Zoë Ann', [], () => 0)).toBe('zoe-ann-0');
    expect(newChildId('!!!', [], () => 0)).toBe('child-0');
  });

  it('draws again when the id is taken', () => {
    const rolls = [0, 0, 0.5];
    expect(newChildId('Maya', ['maya-0'], () => rolls.shift()!)).toBe('maya-i000');
  });
});

describe('emptyDraft', () => {
  it('starts six years back with no override', () => {
    expect(emptyDraft(TODAY, 'owl')).toEqual({
      firstName: '',
      birthdate: '2020-01-01',
      avatar: 'owl',
      gradeOverride: null,
      readingMode: false,
    });
  });
});

describe('effectiveGrade', () => {
  it('uses the derived grade unless a parent overrode it', () => {
    expect(effectiveGrade({ birthdate: '2020-03-14' }, TODAY)).toBe('1');
    expect(effectiveGrade({ birthdate: '2020-03-14', gradeOverride: '2' }, TODAY)).toBe('2');
  });
});

describe('saveChild', () => {
  let repo: Repository;
  beforeEach(async () => {
    repo = await openRepository(openNodeSqliteDatabase(':memory:'));
  });

  it('adds a child with a fresh id and a trimmed name', async () => {
    const child = await saveChild(repo, draft({ firstName: '  Maya ' }));
    expect(child.id).toMatch(/^maya-[a-z0-9]+$/);
    expect(await repo.children.list()).toEqual([
      {
        id: child.id,
        firstName: 'Maya',
        birthdate: '2020-03-14',
        avatar: 'fox',
        readingMode: false,
      },
    ]);
  });

  it('adds a child with a grade override', async () => {
    const child = await saveChild(repo, draft({ gradeOverride: '2' }));
    expect((await repo.children.get(child.id))?.gradeOverride).toBe('2');
    expect(effectiveGrade(child, TODAY)).toBe('2');
  });

  it('edits in place, and clearing the override goes back to the derived grade', async () => {
    const added = await saveChild(repo, draft({ gradeOverride: '2' }));
    const edited = await saveChild(
      repo,
      { ...draftFromChild(added), firstName: 'Mia', gradeOverride: null, avatar: 'owl' },
      added.id,
    );
    expect(edited.id).toBe(added.id);
    expect(await repo.children.list()).toEqual([
      {
        id: added.id,
        firstName: 'Mia',
        birthdate: '2020-03-14',
        avatar: 'owl',
        readingMode: false,
      },
    ]);
    expect(effectiveGrade(edited, TODAY)).toBe('1');
  });

  it('gives two kids with the same name different ids', async () => {
    const a = await saveChild(repo, draft());
    const b = await saveChild(repo, draft());
    expect(a.id).not.toBe(b.id);
    expect(await repo.children.list()).toHaveLength(2);
  });

  it('rejects an empty name without saving', async () => {
    await expect(saveChild(repo, draft({ firstName: '   ' }))).rejects.toThrow();
    expect(await repo.children.list()).toEqual([]);
  });
});

describe('resetting a child', () => {
  it('clears mastery and walk-back, and keeps the profile and attempts', async () => {
    const repo = await openRepository(openNodeSqliteDatabase(':memory:'));
    const child = await saveChild(repo, draft());
    const other = await saveChild(repo, draft({ firstName: 'Leo' }));
    const mastery: MasteryState = {
      childId: child.id,
      skillId: 'g1-add-within-10',
      status: 'gap',
      checkAnswered: 0,
      checkCorrect: 0,
      failedChecks: 2,
      reviewsPassed: 0,
      nextReviewOn: null,
      updatedAt: '2026-11-06T14:30:00Z',
    };
    const attempt: Attempt = {
      childId: child.id,
      skillId: 'g1-add-within-10',
      itemId: 'g1-add-within-10-item-1',
      answer: 3,
      correct: false,
      timeToAnswerMs: 3000,
      narrationReplays: 0,
      sessionId: 's1',
      phase: 'check',
      timestamp: '2026-11-06T14:31:00Z',
    };
    await repo.mastery.save(mastery);
    await repo.mastery.save({ ...mastery, childId: other.id });
    await repo.walkBack.save(child.id, { probes: ['g1-numbers-to-50'], targets: [] });
    await repo.attempts.add(attempt);

    await repo.mastery.removeForChild(child.id);

    expect(await repo.children.get(child.id)).toEqual(child);
    expect(await repo.mastery.listForChild(child.id)).toEqual([]);
    expect(await repo.walkBack.get(child.id)).toBeNull();
    expect(await repo.attempts.listForChild(child.id)).toEqual([attempt]);
    expect(await repo.mastery.listForChild(other.id)).toHaveLength(1);
  });
});
