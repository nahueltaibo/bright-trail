import {
  createLearnerState,
  createPlacementContent,
  createSkillGraph,
  startPlacement,
} from '@bright-trail/shared';
import { loadCore } from './core';
import { aheadGrades } from './packs';
import { diskBundle } from './testing/diskPacks';

describe('aheadGrades', () => {
  const core = loadCore();
  const graph = createSkillGraph(core.skills);

  it('is the grade placement is sampling', () => {
    const content = createPlacementContent(graph, diskBundle().items);
    const state = startPlacement('maya', content, '3');
    expect(aheadGrades(core, { state, placedGrade: null, finishedAt: null }, null)).toEqual(['3']);
  });

  it('adds the grades of prerequisites placement is tracing', () => {
    const content = createPlacementContent(graph, diskBundle().items);
    const kSkill = core.skills.find((s) => s.grade === 'K')!;
    const state = {
      ...startPlacement('maya', content, '2'),
      phase: 'trace' as const,
      grade: null,
      queue: [kSkill.id],
    };
    expect(aheadGrades(core, { state, placedGrade: '2', finishedAt: null }, null)).toEqual(['K']);
  });

  it('is the grades of skills unlocked but not yet mastered after placement', () => {
    const learner = createLearnerState('maya', graph, '2', '2026-11-11T12:00:00Z');
    const content = createPlacementContent(graph, diskBundle().items);
    const placement = {
      state: startPlacement('maya', content, '2'),
      placedGrade: '2' as const,
      finishedAt: '2026-11-11T12:00:00Z',
    };
    const grades = aheadGrades(core, placement, learner);
    expect(grades).toContain('2');
    expect(grades).not.toContain('K');
  });
});
