import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  answerPlacement,
  applyEvent,
  isUnlocked,
  CHECK_SIZE,
  createPlacementContent,
  createSkillGraph,
  finishPlacement,
  isPlacementDone,
  nextPlacementItem,
  nextStep,
  parseContentBundle,
  PLACEMENT_ITEM_BUDGET,
  startPlacement,
  type ContentBundle,
  type SchoolGrade,
} from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import { loadScope, prerequisiteClosure } from './scope';
import { g1Skill } from './fixtures';

const outDir = join(__dirname, '../../out');
const bundle: ContentBundle = parseContentBundle(
  JSON.parse(readFileSync(join(outDir, 'bundle.json'), 'utf8')),
);
const graph = createSkillGraph(bundle.skills);
const content = createPlacementContent(graph, bundle.items);
const gradeOf = (skillId: string) => graph.byId.get(skillId)!.grade;
const rank = (grade: string) => (grade === 'K' ? 0 : Number(grade));
const NOW = '2026-11-07T09:00:00-05:00';
const DAY = '2026-11-07';
const clock = { today: DAY, now: NOW };

/** A simulated kid who gets right every skill up to a grade, and misses the rest. */
function place(grade: SchoolGrade, knowsUpTo: number) {
  let state = startPlacement('kid', content, grade);
  let shown = 0;
  while (!isPlacementDone(state)) {
    const item = nextPlacementItem(state, content)!;
    expect(bundle.items.some((i) => i.id === item.id)).toBe(true);
    state = answerPlacement(state, content, {
      itemId: item.id,
      correct: rank(gradeOf(item.skillId)) <= knowsUpTo,
    });
    shown++;
  }
  expect(shown).toBeLessThanOrEqual(PLACEMENT_ITEM_BUDGET);
  return finishPlacement(state, content, NOW);
}

describe('the generated bundle', () => {
  it('is the prerequisite closure of the scope targets', async () => {
    const scope = await loadScope(join(__dirname, '../../bundle-scope.json'));
    const ids = new Set(bundle.skills.map((s) => s.id));
    for (const target of scope.targets) expect(ids.has(target)).toBe(true);
    for (const skill of bundle.skills) {
      for (const p of skill.prerequisiteIds)
        expect(ids.has(p), `${skill.id} needs ${p}`).toBe(true);
    }
    expect(prerequisiteClosure(bundle.skills, scope.targets)).toHaveLength(bundle.skills.length);
  });

  it('has a story and 15 items for every skill with content, and nothing for others', () => {
    for (const nugget of bundle.nuggets) {
      expect(bundle.items.filter((i) => i.skillId === nugget.skillId)).toHaveLength(15);
    }
    const withContent = new Set(bundle.nuggets.map((n) => n.skillId));
    expect(bundle.items.every((i) => withContent.has(i.skillId))).toBe(true);
  });

  it('places a Grade 1 kid who knows Kindergarten at Grade 1 and teaches a Grade 1 skill', () => {
    const { placedGrade, learner } = place('1', 0);
    expect(placedGrade).toBe('1');
    const step = nextStep(learner, graph, DAY);
    expect(step.kind).toBe('lesson');
    if (step.kind === 'lesson') {
      expect(gradeOf(step.skillId)).toBe('1');
      expect(bundle.nuggets.some((n) => n.skillId === step.skillId)).toBe(true);
    }
  });

  it('places a Grade 5 kid who knows Grade 4 at Grade 5', () => {
    const { placedGrade, learner } = place('5', 4);
    expect(placedGrade).toBe('5');
    const step = nextStep(learner, graph, DAY);
    expect(step).toMatchObject({ kind: 'lesson' });
  });

  it('walks a Grade 5 kid who fails a lesson back to a prerequisite with content', () => {
    const { learner } = place('5', 4);
    // A Grade 5 lesson resting on a prerequisite placement assumed but never probed.
    const lesson = bundle.skills.find(
      (s) =>
        s.grade === '5' &&
        isUnlocked(learner, graph, s.id) &&
        s.prerequisiteIds.some((p) => learner.skills[p].status === 'assumed'),
    );
    expect(lesson).toBeDefined();
    const step = { skillId: lesson!.id };
    let state = learner;
    // Fail the check twice: walk-back must probe an assumed prerequisite that has content.
    for (let check = 0; check < 2; check++) {
      state = applyEvent(state, graph, { type: 'lesson-started', skillId: step.skillId }, clock);
      for (let i = 0; i < CHECK_SIZE; i++) {
        state = applyEvent(
          state,
          graph,
          { type: 'answered', skillId: step.skillId, phase: 'check', correct: false },
          clock,
        );
      }
    }
    const probe = nextStep(state, graph, DAY);
    expect(probe.kind).toBe('probe');
    if (probe.kind === 'probe') {
      expect(prerequisiteClosure(bundle.skills, [step.skillId]).map((s) => s.id)).toContain(
        probe.skillId,
      );
      expect(content.itemsBySkill.get(probe.skillId)?.length).toBe(15);
    }
  });

  it('keeps a scope closure self-contained', () => {
    const skills = [
      { ...g1Skill, id: 'k-a', grade: 'K' as const, prerequisiteIds: [] },
      { ...g1Skill, id: 'g1-b', prerequisiteIds: ['k-a'] },
      { ...g1Skill, id: 'g1-c', prerequisiteIds: ['g1-b'] },
      { ...g1Skill, id: 'g1-d', prerequisiteIds: ['k-a'] },
    ];
    expect(prerequisiteClosure(skills, ['g1-c']).map((s) => s.id)).toEqual(['k-a', 'g1-b', 'g1-c']);
    expect(() => prerequisiteClosure(skills, ['g9-x'])).toThrow(/Unknown target/);
  });
});
