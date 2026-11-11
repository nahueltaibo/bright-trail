import {
  SCHOOL_GRADES,
  answerPlacement,
  createPlacementContent,
  createSkillGraph,
  finishPlacement,
  gradeRank,
  nextPlacementItem,
  startPlacement,
} from '@bright-trail/shared';
import { loadBundle } from './loadBundle';

describe('loadBundle', () => {
  it('loads and validates the generated bundle once', async () => {
    const bundle = await loadBundle();
    expect(bundle.version).not.toBe('sample-1');
    expect(bundle.skills.length).toBeGreaterThan(3);
    expect(await loadBundle()).toBe(bundle);
  });

  it('gives every skill a story and enough items for placement and a check', async () => {
    const bundle = await loadBundle();
    const nuggets = new Set(bundle.nuggets.map((n) => n.skillId));
    for (const skill of bundle.skills) {
      expect(nuggets.has(skill.id)).toBe(true);
      expect(bundle.items.filter((i) => i.skillId === skill.id).length).toBeGreaterThanOrEqual(5);
    }
  });

  // The bundle covers only some grades, so a child in any other grade must start nearby.
  it.each(SCHOOL_GRADES)('runs placement to the end for a %s child', async (grade) => {
    const bundle = await loadBundle();
    const content = createPlacementContent(createSkillGraph(bundle.skills), bundle.items);
    const bundled = new Set(bundle.skills.map((s) => gradeRank(s.grade)));
    const nearest = Math.min(gradeRank(grade), content.topRank);

    for (const correct of [true, false]) {
      let state = startPlacement('kid', content, grade);
      expect(bundled.has(state.grade!)).toBe(true);
      if (bundled.has(nearest)) expect(state.grade).toBe(nearest);
      for (let n = 0; state.phase !== 'done'; n++) {
        expect(n).toBeLessThan(40);
        const item = nextPlacementItem(state, content)!;
        state = answerPlacement(state, content, { itemId: item.id, correct });
      }
      const { learner } = finishPlacement(state, content, '2026-11-07T12:00:00Z');
      expect(Object.keys(learner.skills)).toHaveLength(bundle.skills.length);
    }
  });
});
