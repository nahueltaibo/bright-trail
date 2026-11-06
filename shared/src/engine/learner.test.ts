import { describe, expect, it } from 'vitest';
import sample from '../../fixtures/sample-bundle.json';
import { parseContentBundle } from '../bundle';
import type { Clock } from './dates';
import { createSkillGraph, type GraphSkill, type SkillGraph } from './graph';
import {
  applyEvent,
  createLearnerState,
  isUnlocked,
  LearnerStateSchema,
  markDueReviews,
  type LearnerEvent,
  type LearnerState,
} from './learner';
import { nextStep } from './next-step';

const DAY = '2026-11-06';
const clock = (today: string): Clock => ({ today, now: `${today}T09:00:00-05:00` });

const PASS = [true, true, true, false, true];
const FAIL = [true, false, true, false, true];
const ALL_RIGHT = [true, true, true];
const ONE_WRONG = [true, false, true];

type Phase = Extract<LearnerEvent, { type: 'answered' }>['phase'];

function answer(
  state: LearnerState,
  graph: SkillGraph,
  skillId: string,
  phase: Phase,
  results: boolean[],
  today = DAY,
): LearnerState {
  return results.reduce(
    (s, correct) =>
      applyEvent(s, graph, { type: 'answered', skillId, phase, correct }, clock(today)),
    state,
  );
}

function teach(
  state: LearnerState,
  graph: SkillGraph,
  skillId: string,
  results: boolean[],
  today = DAY,
): LearnerState {
  const started = applyEvent(state, graph, { type: 'lesson-started', skillId }, clock(today));
  return answer(started, graph, skillId, 'check', results, today);
}

const sampleGraph = createSkillGraph(parseContentBundle(sample).skills);

// a <- b <- c <- x, one skill per grade, so a Grade 3 start assumes a, b and c.
const chain: GraphSkill[] = [
  { id: 'a', grade: 'K', prerequisiteIds: [] },
  { id: 'b', grade: '1', prerequisiteIds: ['a'] },
  { id: 'c', grade: '2', prerequisiteIds: ['b'] },
  { id: 'x', grade: '3', prerequisiteIds: ['c'] },
];
const chainGraph = createSkillGraph(chain);

describe('createLearnerState', () => {
  it('assumes skills below the starting grade and leaves the rest unknown', () => {
    const state = createLearnerState('mia', sampleGraph, '1', `${DAY}T09:00:00Z`);
    expect(state.skills['k-count-to-20'].status).toBe('assumed');
    expect(state.skills['g1-numbers-to-50'].status).toBe('unknown');
    expect(state.skills['g1-add-within-10'].status).toBe('unknown');
    expect(LearnerStateSchema.safeParse(state).success).toBe(true);
  });

  it('treats JK and SK as Kindergarten and Grade 7 as above every skill', () => {
    const jk = createLearnerState('mia', sampleGraph, 'JK', `${DAY}T09:00:00Z`);
    expect(Object.values(jk.skills).every((m) => m.status === 'unknown')).toBe(true);
    const g7 = createLearnerState('mia', sampleGraph, '7', `${DAY}T09:00:00Z`);
    expect(Object.values(g7.skills).every((m) => m.status === 'assumed')).toBe(true);
  });
});

describe('unlock rule', () => {
  it('opens a skill only when every prerequisite is mastered or assumed', () => {
    let state = createLearnerState('mia', sampleGraph, 'SK', `${DAY}T09:00:00Z`);
    expect(isUnlocked(state, sampleGraph, 'k-count-to-20')).toBe(true);
    expect(isUnlocked(state, sampleGraph, 'g1-numbers-to-50')).toBe(false);
    expect(nextStep(state, sampleGraph, DAY)).toEqual({ kind: 'lesson', skillId: 'k-count-to-20' });

    state = teach(state, sampleGraph, 'k-count-to-20', PASS);
    expect(isUnlocked(state, sampleGraph, 'g1-numbers-to-50')).toBe(true);
    expect(isUnlocked(state, sampleGraph, 'g1-add-within-10')).toBe(false);
    expect(nextStep(state, sampleGraph, DAY)).toEqual({
      kind: 'lesson',
      skillId: 'g1-numbers-to-50',
    });
  });

  it('refuses to start a locked lesson', () => {
    const state = createLearnerState('mia', sampleGraph, 'SK', `${DAY}T09:00:00Z`);
    expect(() =>
      applyEvent(
        state,
        sampleGraph,
        { type: 'lesson-started', skillId: 'g1-add-within-10' },
        clock(DAY),
      ),
    ).toThrow('prerequisite');
  });

  it('teaches the lowest grade first, then bundle order', () => {
    const graph = createSkillGraph([
      { id: 'g2-late', grade: '2', prerequisiteIds: [] },
      { id: 'g1-second', grade: '1', prerequisiteIds: [] },
      { id: 'k-first', grade: 'K', prerequisiteIds: [] },
      { id: 'g1-third', grade: '1', prerequisiteIds: [] },
    ]);
    let state = createLearnerState('mia', graph, 'K', `${DAY}T09:00:00Z`);
    const order: string[] = [];
    for (let step = nextStep(state, graph, DAY); step.kind === 'lesson';) {
      order.push(step.skillId);
      state = teach(state, graph, step.skillId, PASS);
      step = nextStep(state, graph, DAY);
    }
    expect(order).toEqual(['k-first', 'g1-second', 'g1-third', 'g2-late']);
    expect(nextStep(state, graph, DAY)).toEqual({ kind: 'done' });
  });
});

describe('check', () => {
  const start = () => createLearnerState('mia', sampleGraph, '1', `${DAY}T09:00:00Z`);

  it('starts learning when the nugget is shown', () => {
    const state = applyEvent(
      start(),
      sampleGraph,
      { type: 'lesson-started', skillId: 'g1-numbers-to-50' },
      clock(DAY),
    );
    expect(state.skills['g1-numbers-to-50']).toMatchObject({
      status: 'learning',
      checkAnswered: 0,
    });
  });

  it('masters on 4 of 5 and schedules a review in 2 days', () => {
    const state = teach(start(), sampleGraph, 'g1-numbers-to-50', PASS);
    expect(state.skills['g1-numbers-to-50']).toMatchObject({
      status: 'mastered',
      nextReviewOn: '2026-11-08',
      reviewsPassed: 0,
      failedChecks: 0,
      checkAnswered: 0,
      updatedAt: `${DAY}T09:00:00-05:00`,
    });
  });

  it('resumes a check in progress without the nugget', () => {
    const started = applyEvent(
      start(),
      sampleGraph,
      { type: 'lesson-started', skillId: 'g1-numbers-to-50' },
      clock(DAY),
    );
    const state = answer(started, sampleGraph, 'g1-numbers-to-50', 'check', [true, false]);
    expect(state.skills['g1-numbers-to-50']).toMatchObject({ checkAnswered: 2, checkCorrect: 1 });
    expect(nextStep(state, sampleGraph, DAY)).toEqual({
      kind: 'check',
      skillId: 'g1-numbers-to-50',
    });
  });

  it('reteaches the same skill after one failed check', () => {
    const state = teach(start(), sampleGraph, 'g1-numbers-to-50', FAIL);
    expect(state.skills['g1-numbers-to-50']).toMatchObject({
      status: 'learning',
      failedChecks: 1,
      checkAnswered: 0,
    });
    expect(state.walkBack).toEqual({ probes: [], targets: [] });
    expect(nextStep(state, sampleGraph, DAY)).toEqual({
      kind: 'lesson',
      skillId: 'g1-numbers-to-50',
    });
  });

  it('masters on the second try after a reteach', () => {
    let state = teach(start(), sampleGraph, 'g1-numbers-to-50', FAIL);
    state = teach(state, sampleGraph, 'g1-numbers-to-50', PASS);
    expect(state.skills['g1-numbers-to-50']).toMatchObject({ status: 'mastered', failedChecks: 0 });
  });

  it('rejects check answers before the lesson starts', () => {
    expect(() => answer(start(), sampleGraph, 'g1-numbers-to-50', 'check', [true])).toThrow(
      'no check runs while it is unknown',
    );
  });

  it('does not mutate the state it is given', () => {
    const before = start();
    const copy = structuredClone(before);
    teach(before, sampleGraph, 'g1-numbers-to-50', FAIL);
    expect(before).toEqual(copy);
  });
});

describe('walk-back', () => {
  const failTwice = (state: LearnerState, graph: SkillGraph, skillId: string) =>
    teach(teach(state, graph, skillId, FAIL), graph, skillId, FAIL);

  it('marks a gap after two failed checks and probes its assumed prerequisites', () => {
    const state = failTwice(
      createLearnerState('mia', chainGraph, '3', `${DAY}T09:00:00Z`),
      chainGraph,
      'x',
    );
    expect(state.skills.x).toMatchObject({ status: 'gap', failedChecks: 2 });
    expect(state.walkBack).toEqual({ probes: ['c'], targets: ['x'] });
    expect(nextStep(state, chainGraph, DAY)).toEqual({ kind: 'probe', skillId: 'c' });
  });

  it('walks back two levels and stops at the first prerequisite that passes', () => {
    let state = failTwice(
      createLearnerState('mia', chainGraph, '3', `${DAY}T09:00:00Z`),
      chainGraph,
      'x',
    );

    state = answer(state, chainGraph, 'c', 'probe', ONE_WRONG);
    expect(state.skills.c.status).toBe('gap');
    expect(state.walkBack).toEqual({ probes: ['b'], targets: ['x', 'c'] });
    expect(nextStep(state, chainGraph, DAY)).toEqual({ kind: 'probe', skillId: 'b' });

    state = answer(state, chainGraph, 'b', 'probe', ONE_WRONG);
    expect(state.skills.b.status).toBe('gap');
    expect(nextStep(state, chainGraph, DAY)).toEqual({ kind: 'probe', skillId: 'a' });

    state = answer(state, chainGraph, 'a', 'probe', ALL_RIGHT);
    expect(state.skills.a).toMatchObject({ status: 'mastered', nextReviewOn: null });
    expect(state.walkBack).toEqual({ probes: [], targets: ['x', 'c', 'b'] });

    // The deepest gap is taught first, then the walk back unwinds toward x.
    const order: string[] = [];
    for (let step = nextStep(state, chainGraph, DAY); step.kind === 'lesson';) {
      order.push(step.skillId);
      state = teach(state, chainGraph, step.skillId, PASS);
      step = nextStep(state, chainGraph, DAY);
    }
    expect(order).toEqual(['b', 'c', 'x']);
    expect(state.walkBack).toEqual({ probes: [], targets: [] });
  });

  it('stops at a root and teaches it next', () => {
    let state = failTwice(
      createLearnerState('mia', chainGraph, '3', `${DAY}T09:00:00Z`),
      chainGraph,
      'x',
    );
    for (const id of ['c', 'b', 'a']) state = answer(state, chainGraph, id, 'probe', ONE_WRONG);
    expect(state.walkBack).toEqual({ probes: [], targets: ['x', 'c', 'b', 'a'] });
    expect(nextStep(state, chainGraph, DAY)).toEqual({ kind: 'lesson', skillId: 'a' });
  });

  it('does not probe a mastered prerequisite', () => {
    let state = createLearnerState('mia', sampleGraph, 'SK', `${DAY}T09:00:00Z`);
    state = teach(state, sampleGraph, 'k-count-to-20', PASS);
    state = failTwice(state, sampleGraph, 'g1-numbers-to-50');
    expect(state.walkBack).toEqual({ probes: [], targets: ['g1-numbers-to-50'] });
    expect(nextStep(state, sampleGraph, DAY)).toEqual({
      kind: 'lesson',
      skillId: 'g1-numbers-to-50',
    });
  });

  it('probes every assumed prerequisite of a gap, in prerequisite order', () => {
    const graph = createSkillGraph([
      { id: 'p', grade: '1', prerequisiteIds: [] },
      { id: 'q', grade: '1', prerequisiteIds: [] },
      { id: 'top', grade: '2', prerequisiteIds: ['p', 'q'] },
    ]);
    let state = failTwice(createLearnerState('mia', graph, '2', `${DAY}T09:00:00Z`), graph, 'top');
    expect(state.walkBack.probes).toEqual(['p', 'q']);
    state = answer(state, graph, 'p', 'probe', ALL_RIGHT);
    expect(nextStep(state, graph, DAY)).toEqual({ kind: 'probe', skillId: 'q' });
    state = answer(state, graph, 'q', 'probe', ALL_RIGHT);
    expect(nextStep(state, graph, DAY)).toEqual({ kind: 'lesson', skillId: 'top' });
  });

  it('teaches a walk-back target before a lower-grade gap from elsewhere', () => {
    const graph = createSkillGraph([
      { id: 'k-other', grade: 'K', prerequisiteIds: [] },
      { id: 'g1-base', grade: '1', prerequisiteIds: [] },
      { id: 'g2-top', grade: '2', prerequisiteIds: ['g1-base'] },
    ]);
    let state = createLearnerState('mia', graph, '2', `${DAY}T09:00:00Z`);
    state = {
      ...state,
      skills: { ...state.skills, 'k-other': { ...state.skills['k-other'], status: 'gap' } },
    };
    state = failTwice(state, graph, 'g2-top');
    state = answer(state, graph, 'g1-base', 'probe', ONE_WRONG);
    expect(nextStep(state, graph, DAY)).toEqual({ kind: 'lesson', skillId: 'g1-base' });
  });

  it('gives a walked-back gap two fresh tries when it is taught again', () => {
    let state = createLearnerState('mia', sampleGraph, 'SK', `${DAY}T09:00:00Z`);
    state = teach(state, sampleGraph, 'k-count-to-20', PASS);
    state = failTwice(state, sampleGraph, 'g1-numbers-to-50');
    state = teach(state, sampleGraph, 'g1-numbers-to-50', FAIL);
    expect(state.skills['g1-numbers-to-50']).toMatchObject({ status: 'learning', failedChecks: 1 });
  });
});

describe('assumed prerequisites', () => {
  it('are confirmed as mastered, all the way down, when a check passes', () => {
    const graph = createSkillGraph([
      ...chain,
      { id: 'unrelated', grade: '1', prerequisiteIds: [] },
    ]);
    const state = teach(
      createLearnerState('mia', graph, '3', `${DAY}T09:00:00Z`),
      graph,
      'x',
      PASS,
    );
    for (const id of ['a', 'b', 'c']) {
      expect(state.skills[id]).toMatchObject({ status: 'mastered', nextReviewOn: null });
    }
    expect(state.skills.unrelated.status).toBe('assumed');
  });

  it('stop the confirmation at a skill that is not assumed', () => {
    let state = createLearnerState('mia', chainGraph, '3', `${DAY}T09:00:00Z`);
    state = { ...state, skills: { ...state.skills, b: { ...state.skills.b, status: 'mastered' } } };
    state = { ...state, skills: { ...state.skills, a: { ...state.skills.a, status: 'gap' } } };
    state = teach(state, chainGraph, 'x', PASS);
    expect(state.skills.c.status).toBe('mastered');
    expect(state.skills.a.status).toBe('gap');
  });
});

describe('reviews', () => {
  const mastered = () =>
    teach(
      createLearnerState('mia', sampleGraph, '1', `${DAY}T09:00:00Z`),
      sampleGraph,
      'g1-numbers-to-50',
      PASS,
    );

  it('come due 2 days after mastery and go before any lesson', () => {
    const state = mastered();
    expect(nextStep(state, sampleGraph, '2026-11-07')).toEqual({
      kind: 'lesson',
      skillId: 'g1-add-within-10',
    });
    expect(nextStep(state, sampleGraph, '2026-11-08')).toEqual({
      kind: 'review',
      skillId: 'g1-numbers-to-50',
    });
  });

  it('pass with 3 of 3, then come due 1 week later, then stop', () => {
    let state = answer(
      mastered(),
      sampleGraph,
      'g1-numbers-to-50',
      'review',
      ALL_RIGHT,
      '2026-11-08',
    );
    expect(state.skills['g1-numbers-to-50']).toMatchObject({
      status: 'mastered',
      reviewsPassed: 1,
      nextReviewOn: '2026-11-15',
    });
    expect(nextStep(state, sampleGraph, '2026-11-14').kind).toBe('lesson');
    expect(nextStep(state, sampleGraph, '2026-11-15')).toEqual({
      kind: 'review',
      skillId: 'g1-numbers-to-50',
    });

    state = answer(state, sampleGraph, 'g1-numbers-to-50', 'review', ALL_RIGHT, '2026-11-15');
    expect(state.skills['g1-numbers-to-50']).toMatchObject({
      status: 'mastered',
      reviewsPassed: 2,
      nextReviewOn: null,
    });
    expect(nextStep(state, sampleGraph, '2027-01-01').kind).toBe('lesson');
  });

  it('schedule from the day the review is taken when it runs late', () => {
    const state = answer(
      mastered(),
      sampleGraph,
      'g1-numbers-to-50',
      'review',
      ALL_RIGHT,
      '2026-11-12',
    );
    expect(state.skills['g1-numbers-to-50'].nextReviewOn).toBe('2026-11-19');
  });

  it('move the skill back to learning when one item is wrong', () => {
    const state = answer(
      mastered(),
      sampleGraph,
      'g1-numbers-to-50',
      'review',
      ONE_WRONG,
      '2026-11-08',
    );
    expect(state.skills['g1-numbers-to-50']).toMatchObject({
      status: 'learning',
      reviewsPassed: 0,
      nextReviewOn: null,
      failedChecks: 0,
    });
    // Back in learning, it is retaught ahead of the unknown skill it unlocks.
    expect(nextStep(state, sampleGraph, '2026-11-08')).toEqual({
      kind: 'lesson',
      skillId: 'g1-numbers-to-50',
    });
  });

  it('show as review-due once marked, and still unlock dependents', () => {
    const state = markDueReviews(mastered(), clock('2026-11-08'));
    expect(state.skills['g1-numbers-to-50'].status).toBe('review-due');
    expect(isUnlocked(state, sampleGraph, 'g1-add-within-10')).toBe(true);
    const passed = answer(
      state,
      sampleGraph,
      'g1-numbers-to-50',
      'review',
      ALL_RIGHT,
      '2026-11-08',
    );
    expect(passed.skills['g1-numbers-to-50'].status).toBe('mastered');
  });

  it('are refused for a skill with no review scheduled', () => {
    const state = createLearnerState('mia', sampleGraph, '1', `${DAY}T09:00:00Z`);
    expect(() => answer(state, sampleGraph, 'k-count-to-20', 'review', [true])).toThrow(
      'no review runs',
    );
  });
});
