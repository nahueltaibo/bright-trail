import { parseContentBundle, type Attempt, type MasteryState } from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { describeFlag } from './flagText';
import { displayState, groupSkillsByGrade, placedSkills } from './skillTree';

const bundle = parseContentBundle(sample);
const TODAY = '2026-11-06';

const state = (skillId: string, overrides: Partial<MasteryState> = {}): MasteryState => ({
  childId: 'maya',
  skillId,
  status: 'learning',
  checkAnswered: 0,
  checkCorrect: 0,
  failedChecks: 0,
  reviewsPassed: 0,
  nextReviewOn: null,
  updatedAt: '2026-11-06T14:30:00Z',
  ...overrides,
});

describe('displayState', () => {
  it('shows a mastered skill as review due once its date comes', () => {
    const mastered = state('k-count-to-20', { status: 'mastered', nextReviewOn: '2026-11-06' });
    expect(displayState(mastered, '2026-11-05')).toBe('mastered');
    expect(displayState(mastered, TODAY)).toBe('review-due');
    expect(displayState(undefined, TODAY)).toBe('unknown');
  });
});

describe('groupSkillsByGrade', () => {
  it('groups skills by grade from K up, with each skill state', () => {
    const groups = groupSkillsByGrade(
      bundle.skills,
      [state('k-count-to-20', { status: 'assumed' }), state('g1-add-within-10', { status: 'gap' })],
      TODAY,
    );
    expect(groups.map((g) => [g.grade, g.rows.map((r) => [r.skill.id, r.state])])).toEqual([
      ['K', [['k-count-to-20', 'assumed']]],
      [
        '1',
        [
          ['g1-numbers-to-50', 'unknown'],
          ['g1-add-within-10', 'gap'],
        ],
      ],
    ]);
  });
});

describe('placedSkills', () => {
  it('lists skills placement set, with the placement tally for the ones it asked about', () => {
    const attempt = (skillId: string, correct: boolean, phase: Attempt['phase']): Attempt => ({
      childId: 'maya',
      skillId,
      itemId: `${skillId}-item-1`,
      answer: 1,
      correct,
      timeToAnswerMs: 1000,
      narrationReplays: 0,
      sessionId: 's1',
      phase,
      timestamp: '2026-11-06T14:30:00Z',
    });
    const rows = placedSkills(
      bundle.skills,
      [
        state('k-count-to-20', { status: 'assumed' }),
        state('g1-numbers-to-50', { status: 'mastered' }),
      ],
      [
        attempt('g1-numbers-to-50', true, 'placement'),
        attempt('g1-numbers-to-50', false, 'placement'),
        attempt('g1-numbers-to-50', true, 'check'),
      ],
      TODAY,
    );
    expect(rows.map((r) => [r.skill.id, r.state, r.placementCorrect, r.placementAnswered])).toEqual(
      [
        ['k-count-to-20', 'assumed', 0, 0],
        ['g1-numbers-to-50', 'mastered', 1, 2],
      ],
    );
  });
});

describe('describeFlag', () => {
  const base = { childId: null, bundleVersion: 'sample-1', createdAt: '2026-11-06T14:30:00Z' };

  it('shows the prompt of a flagged item', () => {
    const item = bundle.items[0];
    expect(
      describeFlag({ ...base, contentKind: 'item', contentId: item.id, cardIndex: null }, bundle),
    ).toEqual({
      kind: 'Item',
      text: item.prompt,
      skillTitle: bundle.skills.find((s) => s.id === item.skillId)!.title,
    });
  });

  it('shows the narration of a flagged story card', () => {
    expect(
      describeFlag(
        { ...base, contentKind: 'card', contentId: 'k-count-to-20-story', cardIndex: 0 },
        bundle,
      ),
    ).toEqual({
      kind: 'Story card 1',
      text: 'Pip the penguin loves to count fish.',
      skillTitle: 'Count to 20',
    });
  });

  it('says so when the content is gone from the bundle', () => {
    expect(
      describeFlag({ ...base, contentKind: 'item', contentId: 'gone', cardIndex: null }, bundle),
    ).toEqual({ kind: 'Item', text: null, skillTitle: null });
  });
});
