import { describe, expect, it } from 'vitest';
import sample from '../../fixtures/sample-bundle.json';
import { parseContentBundle } from '../bundle';
import { createSkillGraph, type GraphSkill } from '../engine/graph';
import { LearnerStateSchema } from '../engine/learner';
import { nextStep } from '../engine/next-step';
import { deriveGrade, type SchoolGrade } from '../grade';
import type { SkillGrade } from '../skill';
import {
  answerPlacement,
  createPlacementContent,
  finishPlacement,
  isPlacementDone,
  nextPlacementItem,
  PLACEMENT_ITEM_BUDGET,
  PlacementStateSchema,
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
