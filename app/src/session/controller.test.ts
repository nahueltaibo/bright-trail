import {
  parseContentBundle,
  type ChildProfile,
  type ContentBundle,
  type Item,
  type MasteryState,
} from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { loadBundle } from '../content/loadBundle';
import { openRepository, type Repository } from '../storage/repository';
import { openNodeSqliteDatabase } from '../storage/testing/nodeSqliteDatabase';
import {
  LESSONS_PER_SKILL_PER_SESSION,
  PLACEMENT_ITEMS_PER_SESSION,
  SESSION_CAP_MS,
  type SessionLimits,
} from './constants';
import { Session, type SessionView } from './controller';
import { ItemHistory } from './items';

const bundle: ContentBundle = parseContentBundle(sample);

// Born 2020, so Grade 1 in November 2026: placement starts on the sample's Grade 1 skills.
const maya: ChildProfile = {
  id: 'maya',
  firstName: 'Maya',
  birthdate: '2020-03-14',
  avatar: 'fox',
  readingMode: false,
  dyslexicFont: false,
};

/** A clock tests move by hand. Midday UTC keeps every time zone on the same date. */
function fakeClock(start = '2026-11-06T16:00:00Z') {
  let t = new Date(start).getTime();
  return {
    now: () => new Date(t),
    advance: (ms: number) => {
      t += ms;
    },
  };
}

function answerFor(item: Item, correct: boolean): string | number {
  switch (item.type) {
    case 'tap':
      return correct
        ? item.answerChoiceId
        : item.choices.find((c) => c.id !== item.answerChoiceId)!.id;
    case 'keypad':
      return correct ? item.answer : item.answer + 1;
    case 'number-line':
      return correct ? item.target : item.target === item.min ? item.max : item.min;
  }
}

describe('Session', () => {
  let repo: Repository;
  let clock: ReturnType<typeof fakeClock>;
  let sessions = 0;

  beforeEach(async () => {
    repo = await openRepository(openNodeSqliteDatabase(':memory:'));
    await repo.children.save(maya);
    clock = fakeClock();
    sessions = 0;
  });

  const start = (limits?: Partial<SessionLimits>) =>
    Session.start({
      repo,
      bundle,
      childId: 'maya',
      sessionId: `session-${++sessions}`,
      now: clock.now,
      limits,
    });

  /** Answers the item on screen, then moves on. */
  async function play(session: Session, correct: boolean, replays = 0): Promise<SessionView> {
    const view = session.current;
    if (view.kind !== 'item') throw new Error(`Expected an item, got ${view.kind}`);
    clock.advance(3000);
    await session.answer({
      itemId: view.item.id,
      answer: answerFor(view.item, correct),
      correct,
      msToAnswer: 3000,
      replays,
    });
    return session.next();
  }

  /** Plays until the screen is no longer a placement item. */
  async function playPlacement(session: Session, correct: boolean): Promise<SessionView> {
    while (session.current.kind === 'item' && session.current.phase === 'placement') {
      await play(session, correct);
    }
    return session.current;
  }

  /** Reads the story, then answers every check item the same way. */
  async function playLesson(session: Session, correct: boolean): Promise<string[]> {
    const view = session.current;
    if (view.kind !== 'story') throw new Error(`Expected a story, got ${view.kind}`);
    const items: string[] = [];
    await session.finishStory();
    while (
      session.current.kind === 'item' &&
      session.current.phase === 'check' &&
      items.length < 5
    ) {
      items.push(session.current.item.id);
      await play(session, correct);
    }
    return items;
  }

  /** Placement all wrong: places at Kindergarten with every sample skill a gap. */
  async function placeAtKindergarten() {
    const session = await start();
    await playPlacement(session, false);
    return session;
  }

  async function seedFinishedPlacement(rows: Partial<MasteryState>[]) {
    const placing = await start();
    await playPlacement(placing, false);
    for (const row of rows) {
      const current = (await repo.mastery.get('maya', row.skillId!))!;
      await repo.mastery.save({ ...current, ...row });
    }
  }

  it('uses the named limits by default', () => {
    expect(SESSION_CAP_MS).toBe(10 * 60 * 1000);
    expect(PLACEMENT_ITEMS_PER_SESSION).toBe(14);
    expect(LESSONS_PER_SKILL_PER_SESSION).toBe(2);
  });

  describe('placement', () => {
    it('starts at the child grade and saves its state after every answer', async () => {
      const session = await start();
      const view = session.current;
      expect(view).toMatchObject({ kind: 'item', phase: 'placement' });
      expect(view.kind === 'item' && view.item.skillId).toBe('g1-numbers-to-50');

      await play(session, false);
      const saved = await repo.placement.get('maya');
      expect(saved?.finishedAt).toBeNull();
      expect(saved?.state.itemsAnswered).toBe(1);
    });

    it('stops after the session share of items with a friendly end, and resumes next session', async () => {
      const first = await start({ placementItemsPerSession: 2 });
      await play(first, false);
      const shownThird = (await repo.placement.get('maya'))!.state.current!.itemId;
      expect(await play(first, false)).toMatchObject({ kind: 'end', reason: 'placement-break' });
      const paused = (await repo.placement.get('maya'))!.state;
      expect(paused.itemsAnswered).toBe(2);
      expect(paused.phase).not.toBe('done');
      expect(shownThird).not.toBe(paused.current!.itemId);

      // A new session, as after an app restart, shows the item placement left on screen.
      const second = await start({ placementItemsPerSession: 2 });
      expect(second.current).toMatchObject({
        kind: 'item',
        phase: 'placement',
        item: { id: paused.current!.itemId },
      });
    });

    it('resumes the same item after quitting without answering it', async () => {
      const first = await start();
      await play(first, false);
      const onScreen = first.current.kind === 'item' && first.current.item.id;

      const second = await start();
      expect(second.current.kind === 'item' && second.current.item.id).toBe(onScreen);
    });

    it('restarts placement saved against a bundle that dropped its item', async () => {
      await play(await start(), false);
      const saved = (await repo.placement.get('maya'))!;
      const current = { ...saved.state.current!, itemId: 'dropped-item' };
      await repo.placement.save('maya', { ...saved, state: { ...saved.state, current } });

      const session = await start();
      expect(session.current).toMatchObject({ kind: 'item', phase: 'placement' });
      expect((await repo.placement.get('maya'))!.state.itemsAnswered).toBe(0);
    });

    it('saves the learner state and placed grade, then goes straight to a lesson', async () => {
      const session = await placeAtKindergarten();
      expect(session.current).toMatchObject({
        kind: 'story',
        nugget: { skillId: 'k-count-to-20' },
      });

      const placement = await repo.placement.get('maya');
      expect(placement?.placedGrade).toBe('K');
      expect(placement?.finishedAt).not.toBeNull();
      expect(placement?.state.phase).toBe('done');

      const mastery = await repo.mastery.listForChild('maya');
      expect(Object.fromEntries(mastery.map((m) => [m.skillId, m.status]))).toEqual({
        'k-count-to-20': 'learning',
        'g1-numbers-to-50': 'gap',
        'g1-add-within-10': 'gap',
      });
    });

    it('places above every grade when all is right, and ends with a star per mastered skill', async () => {
      const session = await start();
      const end = await playPlacement(session, true);
      expect(end).toMatchObject({ kind: 'end', reason: 'all-done', stars: 2 });
      expect((await repo.placement.get('maya'))?.placedGrade).toBeNull();
    });

    it('does not restart placement once it has finished', async () => {
      await placeAtKindergarten();
      const next = await start();
      expect(next.current).toMatchObject({ kind: 'story', nugget: { skillId: 'k-count-to-20' } });
    });
  });

  describe('lessons', () => {
    it('runs a story then a 5-item check, and masters the skill on a pass', async () => {
      const session = await placeAtKindergarten();
      const checked = await playLesson(session, true);
      expect(checked).toHaveLength(5);
      expect((await repo.mastery.get('maya', 'k-count-to-20'))?.status).toBe('mastered');
      expect(session.current).toMatchObject({
        kind: 'story',
        nugget: { skillId: 'g1-numbers-to-50' },
      });
    });

    it('shows unseen items first, then the ones seen longest ago', async () => {
      const session = await placeAtKindergarten();
      const placementItems = (await repo.placement.get('maya'))!.state.usedItemIds.filter((id) =>
        id.startsWith('k-count-to-20'),
      );
      expect(placementItems).toEqual(['k-count-to-20-keypad-1', 'k-count-to-20-tap-1']);

      const checked = await playLesson(session, true);
      expect(checked).toEqual([
        'k-count-to-20-line-1',
        'k-count-to-20-keypad-1',
        'k-count-to-20-tap-1',
        'k-count-to-20-line-1',
        'k-count-to-20-keypad-1',
      ]);
    });

    it('counts each check item out of 5, and gives placement no count', async () => {
      const session = await start();
      expect(session.current).toMatchObject({ kind: 'item', phase: 'placement' });
      expect(session.current).not.toHaveProperty('progress');
      await playPlacement(session, false);
      await session.finishStory();
      const seen = [];
      for (let i = 0; i < 5; i++) {
        seen.push((session.current as { progress?: unknown }).progress);
        await play(session, true);
      }
      expect(seen).toEqual([0, 1, 2, 3, 4].map((current) => ({ current, total: 5 })));
    });

    it('resumes a check in progress without the story', async () => {
      const first = await placeAtKindergarten();
      await first.finishStory();
      await play(first, true);
      await play(first, true);

      const second = await start();
      expect(second.current).toMatchObject({
        kind: 'item',
        phase: 'check',
        item: { skillId: 'k-count-to-20' },
        progress: { current: 2, total: 5 },
      });
      expect((await repo.mastery.get('maya', 'k-count-to-20'))?.checkAnswered).toBe(2);
    });

    it('teaches one skill at most twice a session, then ends for the day', async () => {
      const session = await placeAtKindergarten();
      expect(await playLesson(session, false)).toHaveLength(5);
      expect(session.current).toMatchObject({
        kind: 'story',
        nugget: { skillId: 'k-count-to-20' },
      });
      expect(await playLesson(session, false)).toHaveLength(5);

      // Two failed checks with no prerequisite to probe: the engine would pick it again.
      expect((await repo.mastery.get('maya', 'k-count-to-20'))?.status).toBe('gap');
      expect(session.current).toMatchObject({ kind: 'end', reason: 'done-for-today' });

      const tomorrow = await start();
      expect(tomorrow.current).toMatchObject({
        kind: 'story',
        nugget: { skillId: 'k-count-to-20' },
      });
    });
  });

  describe('session cap', () => {
    it('lets the child finish the item on screen, then ends', async () => {
      const session = await start();
      clock.advance(SESSION_CAP_MS);
      const view = session.current;
      if (view.kind !== 'item') throw new Error('Expected an item');
      await session.answer({
        itemId: view.item.id,
        answer: answerFor(view.item, true),
        correct: true,
        msToAnswer: 1000,
        replays: 0,
      });
      expect(await repo.attempts.listForChild('maya')).toHaveLength(1);
      expect(await session.next()).toMatchObject({ kind: 'end', reason: 'time-up' });
    });

    it('does not end before the cap', async () => {
      const session = await start();
      clock.advance(SESSION_CAP_MS - 10_000);
      expect(await play(session, true)).toMatchObject({ kind: 'item' });
    });
  });

  describe('attempts', () => {
    it('logs placement and check answers with phase, time, replays, and session id', async () => {
      const session = await start();
      await play(session, false, 2);
      await playPlacement(session, false);
      await session.finishStory();
      await play(session, true);

      const attempts = await repo.attempts.listForChild('maya');
      expect(attempts.map((a) => a.phase)).toEqual([...Array(6).fill('placement'), 'check']);
      expect(attempts[0]).toMatchObject({
        childId: 'maya',
        skillId: 'g1-numbers-to-50',
        itemId: 'g1-numbers-to-50-keypad-1',
        answer: 51,
        correct: false,
        timeToAnswerMs: 3000,
        narrationReplays: 2,
        sessionId: 'session-1',
      });
      expect(attempts.at(-1)).toMatchObject({ skillId: 'k-count-to-20', correct: true });
    });

    it('logs a due review as a 3-item review', async () => {
      await seedFinishedPlacement([
        { skillId: 'k-count-to-20', status: 'mastered', nextReviewOn: '2026-11-06' },
      ]);
      const session = await start();
      expect(session.current).toMatchObject({
        kind: 'item',
        phase: 'review',
        progress: { current: 0, total: 3 },
      });
      for (let i = 0; i < 3; i++) await play(session, true);
      const reviews = (await repo.attempts.listForChild('maya')).filter(
        (a) => a.sessionId === 'session-2',
      );
      expect(reviews.map((a) => a.phase)).toEqual(['review', 'review', 'review']);
      expect((await repo.mastery.get('maya', 'k-count-to-20'))?.reviewsPassed).toBe(1);
    });

    it('logs a walk-back probe as a probe', async () => {
      await seedFinishedPlacement([{ skillId: 'k-count-to-20', status: 'assumed' }]);
      await repo.walkBack.save('maya', {
        probes: ['k-count-to-20'],
        targets: ['g1-numbers-to-50'],
      });
      const session = await start();
      expect(session.current).toMatchObject({
        kind: 'item',
        phase: 'probe',
        item: { skillId: 'k-count-to-20' },
        progress: { current: 0, total: 3 },
      });
      await play(session, true);
      const last = (await repo.attempts.listForChild('maya')).at(-1);
      expect(last).toMatchObject({ phase: 'probe', sessionId: 'session-2' });
    });

    it('ignores a second answer to the same item', async () => {
      const session = await start();
      const view = session.current;
      if (view.kind !== 'item') throw new Error('Expected an item');
      const result = {
        itemId: view.item.id,
        answer: answerFor(view.item, true),
        correct: true,
        msToAnswer: 1000,
        replays: 0,
      };
      await Promise.all([session.answer(result), session.answer(result)]);
      expect(await repo.attempts.listForChild('maya')).toHaveLength(1);
    });
  });

  it('saves flags with the child, bundle version, and time', async () => {
    const session = await start();
    await session.flag({
      contentKind: 'item',
      contentId: 'g1-numbers-to-50-keypad-1',
      cardIndex: null,
    });
    await session.flag({ contentKind: 'card', contentId: 'k-count-to-20-story', cardIndex: 2 });
    const flags = await repo.flags.list();
    expect(flags.map(({ id, createdAt, ...f }) => f)).toEqual([
      {
        childId: 'maya',
        contentKind: 'card',
        contentId: 'k-count-to-20-story',
        cardIndex: 2,
        bundleVersion: 'sample-1',
        resolvedAt: null,
      },
      {
        childId: 'maya',
        contentKind: 'item',
        contentId: 'g1-numbers-to-50-keypad-1',
        cardIndex: null,
        bundleVersion: 'sample-1',
        resolvedAt: null,
      },
    ]);
    expect(new Date(flags[0].createdAt).getTime()).toBe(clock.now().getTime());
  });
});

describe('Session with the generated bundle', () => {
  // Grade 6 is above the bundle, so placement starts at its top grade and walks down from there.
  it('splits a long all-wrong placement over two sessions, then teaches Kindergarten', async () => {
    const real = await loadBundle();
    const repo = await openRepository(openNodeSqliteDatabase(':memory:'));
    await repo.children.save({ ...maya, gradeOverride: '6' });
    const clock = fakeClock();
    let sessions = 0;
    const start = () =>
      Session.start({
        repo,
        bundle: real,
        childId: 'maya',
        sessionId: `session-${++sessions}`,
        now: clock.now,
      });
    const playWrong = async (session: Session) => {
      let answered = 0;
      while (session.current.kind === 'item' && session.current.phase === 'placement') {
        const { item } = session.current;
        clock.advance(3000);
        await session.answer({
          itemId: item.id,
          answer: answerFor(item, false),
          correct: false,
          msToAnswer: 3000,
          replays: 0,
        });
        await session.next();
        answered++;
      }
      return answered;
    };

    const first = await start();
    expect(first.current.kind === 'item' && first.current.item.skillId).toMatch(/^g5-/);
    expect(await playWrong(first)).toBe(PLACEMENT_ITEMS_PER_SESSION);
    expect(first.current).toMatchObject({ kind: 'end', reason: 'placement-break' });

    const second = await start();
    await playWrong(second);
    expect(second.current).toMatchObject({ kind: 'story', nugget: { skillId: 'k-count-to-20' } });
    expect((await repo.placement.get('maya'))?.placedGrade).toBe('K');
  });
});

describe('ItemHistory', () => {
  const items = bundle.items.filter((i) => i.skillId === 'k-count-to-20');

  it('picks unseen items in bundle order, then the least recently seen', () => {
    const history = new ItemHistory(['k-count-to-20-tap-1']);
    const picked: string[] = [];
    for (let i = 0; i < 4; i++) {
      const item = history.pick(items)!;
      picked.push(item.id);
      history.see(item.id);
    }
    expect(picked).toEqual([
      'k-count-to-20-keypad-1',
      'k-count-to-20-line-1',
      'k-count-to-20-tap-1',
      'k-count-to-20-keypad-1',
    ]);
  });

  it('returns null for a skill with no items', () => {
    expect(new ItemHistory().pick([])).toBeNull();
  });
});
