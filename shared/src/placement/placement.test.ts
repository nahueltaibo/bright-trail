import { describe, expect, it } from 'vitest';
import sample from '../../fixtures/sample-bundle.json';
import { parseContentBundle } from '../bundle';
import { createSkillGraph, type GraphSkill } from '../engine/graph';
import { LearnerStateSchema } from '../engine/learner';
import { nextStep } from '../engine/next-step';
import { deriveGrade, type SchoolGrade } from '../grade';
import { packId, packsFor } from '../packs';
import type { SkillGrade } from '../skill';
import {
  answerPlacement,
  createPlacementContent,
  finishPlacement,
  isPlacementDone,
  nextPlacementItem,
  nextPlacementStep,
  PLACEMENT_ITEM_BUDGET,
  placementGradesAhead,
  PlacementStateSchema,
  resumePlacement,
  startPlacement,
  type PlacementContent,
  type PlacementItem,
  type PlacementState,
} from './placement';

const DAY = '2026-11-06';
const NOW = `${DAY}T09:00:00-05:00`;

const GRADES = ['K', '1', '2', '3', '4', '5', '6'] as const;
const id = (rank: number, letter: string) => (rank === 0 ? `k-${letter}` : `g${rank}-${letter}`);

// K to Grade 6, four skills a grade. a, b and c build on the same letter a grade below.
// d is a leaf on a, so a has the most dependents and d none.
const ladder: GraphSkill[] = GRADES.flatMap((grade, rank) =>
  ['a', 'b', 'c', 'd'].map((letter) => ({
    id: id(rank, letter),
    grade,
    prerequisiteIds: letter === 'd' ? [id(rank, 'a')] : rank === 0 ? [] : [id(rank - 1, letter)],
  })),
);

function fakeItems(skills: readonly GraphSkill[], difficulties = [1, 2, 2, 3]): PlacementItem[] {
  return skills.flatMap((s) =>
    difficulties.map((difficulty, i) => ({ id: `${s.id}-item-${i}`, skillId: s.id, difficulty })),
  );
}

const ladderContent = createPlacementContent(createSkillGraph(ladder), fakeItems(ladder));

/** A simulated kid who answers right exactly on the skills they know. */
type Kid = (skillId: string) => boolean;

function play(
  content: PlacementContent,
  state: PlacementState,
  kid: Kid,
  limit = Infinity,
): { state: PlacementState; shown: PlacementItem[] } {
  const shown: PlacementItem[] = [];
  while (!isPlacementDone(state) && shown.length < limit) {
    const item = nextPlacementItem(state, content)!;
    shown.push(item);
    state = answerPlacement(state, content, { itemId: item.id, correct: kid(item.skillId) });
  }
  return { state, shown };
}

function place(content: PlacementContent, grade: SkillGrade | SchoolGrade, kid: Kid) {
  const { state, shown } = play(content, startPlacement('mia', content, grade), kid);
  const result = finishPlacement(state, content, NOW);
  expect(LearnerStateSchema.safeParse(result.learner).success).toBe(true);
  expect(new Set(shown.map((i) => i.id)).size).toBe(shown.length);
  expect(shown.length).toBeLessThanOrEqual(PLACEMENT_ITEM_BUDGET);
  const status = (skillId: string) => result.learner.skills[skillId].status;
  return { ...result, state, shown, status };
}

const rankOf = (skillId: string) =>
  skillId.startsWith('k-') ? 0 : Number(skillId.slice(1, skillId.indexOf('-')));

describe('placement over a K to Grade 6 graph', () => {
  it('samples the skills with the most dependents and starts each at medium difficulty', () => {
    const state = startPlacement('mia', ladderContent, '1');
    expect(nextPlacementItem(state, ladderContent)).toMatchObject({
      skillId: 'g1-a',
      difficulty: 2,
    });
    const { shown } = place(ladderContent, '1', () => true);
    expect(shown.some((i) => i.skillId.endsWith('-d'))).toBe(false);
  });

  it('places a Grade 1 kid who is strong in K and weak in Grade 1 at Grade 1', () => {
    const grade = deriveGrade('2020-05-14', DAY);
    expect(grade).toBe('1');
    const { placedGrade, status, learner, state } = place(
      ladderContent,
      grade,
      (s) => rankOf(s) === 0,
    );
    expect(placedGrade).toBe('1');
    expect(state.grades).toEqual([
      { grade: 1, outcome: 'weak' },
      { grade: 0, outcome: 'strong' },
    ]);
    for (const s of ['k-a', 'k-b', 'k-c']) expect(status(s)).toBe('mastered');
    expect(status('k-d')).toBe('assumed');
    expect(status('g1-a')).toBe('gap');
    expect(status('g1-b')).toBe('gap');
    expect(status('g1-c')).toBe('unknown');
    expect(status('g2-a')).toBe('unknown');
    expect(nextStep(learner, ladderContent.graph, DAY)).toEqual({
      kind: 'lesson',
      skillId: 'g1-a',
    });
  });

  it('finds a hidden Grade 3 gap under a Grade 5 kid', () => {
    const missing = new Set(['g3-b', 'g4-b', 'g5-b', 'g6-b']);
    const { placedGrade, status, learner, shown } = place(
      ladderContent,
      '5',
      (s) => !missing.has(s),
    );
    expect(placedGrade).toBe('5');
    expect(status('g5-a')).toBe('mastered');
    expect(status('g5-b')).toBe('gap');
    expect(status('g4-b')).toBe('gap');
    expect(status('g3-b')).toBe('gap');
    expect(status('g2-b')).toBe('mastered');
    expect(status('g4-a')).toBe('assumed');
    expect(status('g1-b')).toBe('assumed');
    expect(shown.length).toBeLessThan(PLACEMENT_ITEM_BUDGET);
    // The deepest gap is taught first.
    expect(nextStep(learner, ladderContent.graph, DAY)).toEqual({
      kind: 'lesson',
      skillId: 'g3-b',
    });
  });

  it('places a kid who answers everything right above the graph when the budget allows', () => {
    const { placedGrade, learner, state } = place(ladderContent, '5', () => true);
    expect(placedGrade).toBeNull();
    expect(state.grades.map((g) => g.outcome)).toEqual(['strong', 'strong']);
    expect(
      Object.values(learner.skills).every((m) => ['mastered', 'assumed'].includes(m.status)),
    ).toBe(true);
    expect(nextStep(learner, ladderContent.graph, DAY)).toEqual({ kind: 'done' });
  });

  it('stops climbing at the item budget', () => {
    const { placedGrade, shown, state } = place(ladderContent, '1', () => true);
    expect(placedGrade).toBe('5');
    expect(state.grades.map((g) => g.grade)).toEqual([1, 2, 3, 4]);
    expect(shown.length).toBeGreaterThan(PLACEMENT_ITEM_BUDGET - 3);
  });

  it('walks a kid who answers everything wrong down to Kindergarten', () => {
    const { placedGrade, status, learner, state } = place(ladderContent, '5', () => false);
    expect(placedGrade).toBe('K');
    expect(state.grades.map((g) => g.grade)).toEqual([5, 4, 3, 2, 1, 0]);
    expect(state.grades.every((g) => g.outcome === 'weak')).toBe(true);
    expect(status('k-a')).toBe('gap');
    expect(Object.values(learner.skills).some((m) => m.status === 'assumed')).toBe(false);
    expect(nextStep(learner, ladderContent.graph, DAY)).toEqual({
      kind: 'lesson',
      skillId: 'k-a',
    });
  });

  it('resumes from saved JSON exactly where it paused', () => {
    const missing = new Set(['g3-b', 'g4-b', 'g5-b', 'g6-b']);
    const kid: Kid = (s) => !missing.has(s);
    const straight = play(ladderContent, startPlacement('mia', ladderContent, '5'), kid);

    // Pause mid-skill: one item of g5-c answered, the next one on screen.
    const first = play(ladderContent, startPlacement('mia', ladderContent, '5'), kid, 5);
    const onScreen = nextPlacementItem(first.state, ladderContent);
    const saved = JSON.stringify(first.state);
    const resumed = PlacementStateSchema.parse(JSON.parse(saved));
    expect(nextPlacementItem(resumed, ladderContent)).toEqual(onScreen);

    const second = play(ladderContent, resumed, kid);
    expect([...first.shown, ...second.shown]).toEqual(straight.shown);
    expect(finishPlacement(second.state, ladderContent, NOW)).toEqual(
      finishPlacement(straight.state, ladderContent, NOW),
    );
  });

  it('rejects an answer to an item that is not on screen, and finishing early', () => {
    const state = startPlacement('mia', ladderContent, '1');
    expect(() =>
      answerPlacement(state, ladderContent, { itemId: 'k-a-item-0', correct: true }),
    ).toThrow('Expected an answer');
    expect(() => finishPlacement(state, ladderContent, NOW)).toThrow('not done');
  });

  it('does not mutate the state it is given', () => {
    const state = startPlacement('mia', ladderContent, '1');
    const copy = structuredClone(state);
    answerPlacement(state, ladderContent, {
      itemId: nextPlacementItem(state, ladderContent)!.id,
      correct: false,
    });
    expect(state).toEqual(copy);
  });
});

describe('placement with packs not installed', () => {
  const ladderGraph = createSkillGraph(ladder);
  const installedOnly = (missing: readonly SkillGrade[]) =>
    createPlacementContent(
      ladderGraph,
      fakeItems(ladder.filter((s) => !missing.includes(s.grade))),
      missing,
    );

  /** Plays to the end, installing each pack placement asks for. */
  function playInstalling(missing: SkillGrade[], grade: SkillGrade, kid: Kid) {
    let content = installedOnly(missing);
    let state = startPlacement('mia', content, grade);
    const asked: SkillGrade[] = [];
    const shown: PlacementItem[] = [];
    for (;;) {
      const step = nextPlacementStep(state, content);
      if (step.kind === 'done') break;
      if (step.kind === 'need-pack') {
        asked.push(step.grade);
        missing = missing.filter((g) => g !== step.grade);
        content = installedOnly(missing);
        state = resumePlacement(state, content);
        continue;
      }
      shown.push(step.item);
      state = answerPlacement(state, content, {
        itemId: step.item.id,
        correct: kid(step.item.skillId),
      });
    }
    return { state, shown, asked };
  }

  const hiddenGap = new Set(['g3-b', 'g4-b', 'g5-b', 'g6-b']);
  const kids: Record<string, Kid> = {
    'a hidden Grade 3 gap': (s) => !hiddenGap.has(s),
    'everything wrong': () => false,
    'everything right': () => true,
  };

  it('asks for the pack of the grade it starts at instead of starting elsewhere', () => {
    const content = installedOnly(['3']);
    const state = startPlacement('mia', content, '3');
    expect(nextPlacementStep(state, content)).toEqual({ kind: 'need-pack', grade: '3' });
    expect(nextPlacementItem(state, content)).toBeNull();
    const resumed = resumePlacement(state, ladderContent);
    expect(nextPlacementStep(resumed, ladderContent)).toMatchObject({
      kind: 'item',
      item: { skillId: 'g3-a' },
    });
  });

  it('asks for the next grade down when the child struggles', () => {
    const { asked } = playInstalling(['4', '3'], '5', () => false);
    expect(asked).toEqual(['4', '3']);
  });

  it('asks for a traced prerequisite below the placed grade', () => {
    const { asked, state } = playInstalling(['3'], '5', kids['a hidden Grade 3 gap']);
    expect(asked).toEqual(['3']);
    expect(state.results).toContainEqual({ skillId: 'g3-b', passed: false });
  });

  for (const [name, kid] of Object.entries(kids)) {
    it(`places a kid with ${name} as if every pack were installed`, () => {
      const straight = play(ladderContent, startPlacement('mia', ladderContent, '5'), kid);
      const installing = playInstalling(['K', '2', '3', '4', '6'], '5', kid);
      expect(installing.shown).toEqual(straight.shown);
      expect(finishPlacement(installing.state, ladderContent, NOW)).toEqual(
        finishPlacement(straight.state, ladderContent, NOW),
      );
    });
  }

  it('keeps waiting while the pack is still missing', () => {
    const content = installedOnly(['3']);
    const state = startPlacement('mia', content, '3');
    expect(resumePlacement(state, content)).toBe(state);
    expect(() =>
      answerPlacement(state, content, { itemId: 'g3-a-item-0', correct: true }),
    ).toThrow();
  });

  it('moves on when the installed pack has nothing to probe', () => {
    const state = startPlacement('mia', installedOnly(['3']), '3');
    const empty = createPlacementContent(
      ladderGraph,
      fakeItems(ladder.filter((s) => s.grade !== '3')),
    );
    const resumed = resumePlacement(state, empty);
    expect(nextPlacementStep(resumed, empty)).toMatchObject({
      kind: 'item',
      item: { skillId: 'g2-a' },
    });
  });

  it('names the grades it may sample next, for packsFor to download ahead', () => {
    const state = startPlacement('mia', ladderContent, '3');
    const ahead = placementGradesAhead(state, ladderContent);
    expect(ahead).toEqual(['2', '3', '4']);
    const available = GRADES.map((g) => ({
      id: packId('math', g),
      subject: 'math' as const,
      grade: g,
    }));
    expect(packsFor({ subjects: ['math'], grade: '1' }, available, ahead)).toEqual([
      'math-k',
      'math-1',
      'math-2',
      'math-3',
      'math-4',
    ]);
  });

  it('reads placement saved before packs as not waiting', () => {
    const old: Partial<PlacementState> = startPlacement('mia', ladderContent, '1');
    delete old.waitingFor;
    expect(PlacementStateSchema.parse(old).waitingFor).toBeNull();
  });
});

describe('placement over the sample bundle', () => {
  const bundle = parseContentBundle(sample);
  const content = createPlacementContent(createSkillGraph(bundle.skills), bundle.items);

  it('picks items by difficulty, harder after a right answer and easier after a miss', () => {
    const right = play(content, startPlacement('mia', content, '1'), () => true);
    expect(right.shown.slice(0, 2).map((i) => i.id)).toEqual([
      'g1-numbers-to-50-keypad-1',
      'g1-numbers-to-50-line-1',
    ]);
    const wrong = play(content, startPlacement('mia', content, '1'), () => false);
    expect(wrong.shown.slice(0, 2).map((i) => i.id)).toEqual([
      'g1-numbers-to-50-keypad-1',
      'g1-numbers-to-50-tap-1',
    ]);
  });

  it('places a kid who knows only Kindergarten at Grade 1, ready for the engine', () => {
    const { placedGrade, status, learner } = place(content, 'SK', (s) => s.startsWith('k-'));
    expect(placedGrade).toBe('1');
    expect(status('k-count-to-20')).toBe('mastered');
    expect(status('g1-numbers-to-50')).toBe('gap');
    expect(nextStep(learner, content.graph, DAY)).toEqual({
      kind: 'lesson',
      skillId: 'g1-numbers-to-50',
    });
  });
});
