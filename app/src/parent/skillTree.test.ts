import {
  parseContentBundle,
  type Attempt,
  type MasteryState,
  type Skill,
} from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { describeFlag } from './flagText';
import {
  GRAPH,
  displayState,
  groupSkillsByGrade,
  layoutSkillGraph,
  placementResults,
} from './skillTree';

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

describe('placementResults', () => {
  const attempt = (itemId: string, correct: boolean, phase: Attempt['phase']): Attempt => ({
    childId: 'maya',
    skillId: itemId.replace(/-(tap|keypad|line)-\d+$/, ''),
    itemId,
    answer: 1,
    correct,
    timeToAnswerMs: 1000,
    narrationReplays: 0,
    sessionId: 's1',
    phase,
    timestamp: '2026-11-06T14:30:00Z',
  });

  it('lists only the skills placement asked about, in grade order, with their tally', () => {
    const rows = placementResults(
      bundle.skills,
      {
        results: [
          { skillId: 'g1-numbers-to-50', passed: false },
          { skillId: 'k-count-to-20', passed: true },
        ],
        usedItemIds: [
          'g1-numbers-to-50-keypad-1',
          'g1-numbers-to-50-tap-1',
          'k-count-to-20-keypad-1',
          'k-count-to-20-line-1',
        ],
      },
      [
        // From a placement before a reset: superseded by the later answer to the same item.
        attempt('g1-numbers-to-50-keypad-1', true, 'placement'),
        attempt('g1-numbers-to-50-keypad-1', false, 'placement'),
        attempt('g1-numbers-to-50-tap-1', false, 'placement'),
        attempt('k-count-to-20-keypad-1', true, 'placement'),
        attempt('k-count-to-20-line-1', true, 'placement'),
        attempt('k-count-to-20-tap-1', false, 'check'),
      ],
    );
    expect(rows.map((r) => [r.skill.id, r.passed, r.correct, r.answered])).toEqual([
      ['k-count-to-20', true, 2, 2],
      ['g1-numbers-to-50', false, 0, 2],
    ]);
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

describe('layoutSkillGraph', () => {
  const base = bundle.skills[1]!;
  const skill = (id: string, grade: Skill['grade'], prerequisiteIds: string[] = []): Skill => ({
    ...base,
    id,
    grade,
    framework: grade === 'K' ? 'ontario-kindergarten-2026' : 'ontario-math-2020',
    prerequisiteIds,
  });
  const lay = (skills: Skill[]) => layoutSkillGraph(groupSkillsByGrade(skills, [], TODAY));
  const layer = (x: number) => x / (GRAPH.nodeWidth + GRAPH.layerGap);

  it('puts each grade in its own columns, and same-grade prerequisites left of what they unlock', () => {
    const layout = lay([
      skill('k-a', 'K'),
      skill('g1-b', '1', ['g1-a']),
      skill('g1-a', '1', ['k-a']),
      skill('g1-c', '1'),
      skill('g2-a', '2', ['g1-b', 'k-a']),
    ]);
    const x = Object.fromEntries(layout.nodes.map((n) => [n.skill.id, layer(n.x)]));
    expect(x).toEqual({ 'k-a': 0, 'g1-a': 1, 'g1-c': 1, 'g1-b': 2, 'g2-a': 3 });
    expect(layout.columns.map((c) => [c.grade, layer(c.x)])).toEqual([
      ['K', 0],
      ['1', 1],
      ['2', 3],
    ]);
    expect(layout.edges).toEqual(
      expect.arrayContaining([
        ['k-a', 'g1-a'],
        ['g1-a', 'g1-b'],
        ['g1-b', 'g2-a'],
        ['k-a', 'g2-a'],
      ]),
    );
    expect(layout.edges).toHaveLength(4);
    expect(layout.width).toBe(4 * GRAPH.nodeWidth + 3 * GRAPH.layerGap);
  });

  it('orders a layer by where its prerequisites sit, and keeps nodes apart', () => {
    const layout = lay([
      skill('k-a', 'K'),
      skill('k-b', 'K'),
      skill('g1-from-b', '1', ['k-b']),
      skill('g1-from-a', '1', ['k-a']),
    ]);
    const y = Object.fromEntries(layout.nodes.map((n) => [n.skill.id, n.y]));
    expect(y['g1-from-a']).toBe(y['k-a']);
    expect(y['g1-from-b']).toBe(y['k-b']);
    expect(y['k-b']! - y['k-a']!).toBe(GRAPH.nodeHeight + GRAPH.rowGap);
    expect(layout.height).toBe(GRAPH.top + 2 * GRAPH.nodeHeight + GRAPH.rowGap);
  });

  it('leaves out prerequisites that are not in the bundle', () => {
    expect(lay([skill('g1-a', '1', ['k-missing'])]).edges).toEqual([]);
  });
});
