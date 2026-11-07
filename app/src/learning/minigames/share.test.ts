import { formatPieces, layoutStage, parseAmount, planDeal } from './share';

describe('parseAmount', () => {
  it.each([
    ['4', 2, 8],
    ['2 1/2', 2, 5],
    ['3/4', 4, 3],
    ['1 1/2', 4, 6],
    ['1 1/3', 3, 4],
  ])('reads "%s" for %i friends as %i pieces', (label, friends, pieces) => {
    expect(parseAmount(label, friends).pieces).toBe(pieces);
  });

  it("rejects pieces the friends can't share", () => {
    expect(() => parseAmount('1/3', 2)).toThrow();
    expect(() => parseAmount('two', 2)).toThrow();
    expect(() => parseAmount('1 1/2', 2, false)).toThrow();
    expect(parseAmount('3', 2, false).pieces).toBe(6);
  });
});

describe('formatPieces', () => {
  it.each([
    [8, 2, '4'],
    [5, 2, '2 1/2'],
    [3, 4, '3/4'],
    [6, 4, '1 1/2'],
    [0, 3, '0'],
  ])('writes %i pieces of 1/%i as "%s"', (pieces, den, text) => {
    expect(formatPieces(pieces, den)).toBe(text);
  });
});

const kinds = (plan: ReturnType<typeof planDeal>) => plan.steps.map((s) => s.kind[0]).join('');

describe('planDeal', () => {
  it('deals whole objects one round at a time and ends fair', () => {
    const plan = planDeal(8, 2, 8);
    expect(plan.result).toBe('fair');
    expect(plan.steps).toHaveLength(8);
    expect(plan.steps.slice(0, 3)).toEqual([
      { kind: 'whole', thing: 0, friend: 0, slot: 0 },
      { kind: 'whole', thing: 1, friend: 1, slot: 0 },
      { kind: 'whole', thing: 2, friend: 0, slot: 1 },
    ]);
  });

  it('leaves objects on the plate when the amount is too small', () => {
    expect(planDeal(8, 2, 6)).toMatchObject({ result: 'leftover', leftover: 4 });
  });

  it('runs out when the amount is too big', () => {
    const plan = planDeal(8, 2, 10);
    expect(plan.result).toBe('short');
    expect(plan.steps).toHaveLength(8);
  });

  it('cuts the last object to share 5 between 2', () => {
    const plan = planDeal(5, 2, 5);
    expect(plan.result).toBe('fair');
    expect(kinds(plan)).toBe('wwwwcpp');
    expect(plan.steps.at(-1)).toEqual({
      kind: 'piece',
      thing: 4,
      piece: 1,
      friend: 1,
      slot: 2,
      at: 0,
    });
  });

  it('cuts every object when each friend gets less than one', () => {
    const plan = planDeal(3, 4, 3);
    expect(plan.result).toBe('fair');
    expect(kinds(plan)).toBe('cppppcppppcpppp');
  });

  it('leaves a piece over when the fraction is too small', () => {
    // 3 pies, 4 friends, 2/4 each: one pie stays whole.
    expect(planDeal(3, 4, 2)).toMatchObject({ result: 'leftover', leftover: 4 });
    // 5 cookies, 2 friends, 2 each: one cookie stays whole.
    expect(planDeal(5, 2, 4)).toMatchObject({ result: 'leftover', leftover: 2 });
  });

  it('runs out of pieces when the fraction is too big', () => {
    expect(planDeal(5, 2, 7).result).toBe('short');
    expect(planDeal(3, 4, 4).result).toBe('short');
    // 1 pie, 4 friends, 2/4 each: the second round of pieces has nothing to cut.
    expect(planDeal(1, 4, 2).result).toBe('short');
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
