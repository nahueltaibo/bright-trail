import { layoutStage, planDeal } from './share';

describe('planDeal', () => {
  it('deals one round at a time and ends fair', () => {
    const plan = planDeal(8, 2, 4);
    expect(plan.result).toBe('fair');
    expect(plan.steps).toHaveLength(8);
    expect(plan.steps.slice(0, 3)).toEqual([
      { thing: 0, friend: 0, slot: 0 },
      { thing: 1, friend: 1, slot: 0 },
      { thing: 2, friend: 0, slot: 1 },
    ]);
  });

  it('leaves objects on the plate when the guess is too small', () => {
    expect(planDeal(8, 2, 3)).toMatchObject({ result: 'leftover', leftover: 2, missing: 0 });
  });

  it('runs out when the guess is too big', () => {
    const plan = planDeal(8, 2, 5);
    expect(plan).toMatchObject({ result: 'short', leftover: 0, missing: 2 });
    expect(plan.steps).toHaveLength(8);
  });
});

describe('layoutStage', () => {
  it.each([
    [360, 420],
    [800, 300],
  ])('keeps every slot inside a %ix%i stage', (w, h) => {
    const stage = layoutStage(w, h, 12, 3, 6);
    const points = [...stage.source, ...stage.friends.flatMap((f) => f.slots)];
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + stage.size).toBeLessThanOrEqual(w);
      expect(p.y + stage.size).toBeLessThanOrEqual(h);
    }
  });
});
