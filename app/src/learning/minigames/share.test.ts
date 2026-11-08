import { parseAmount, sceneProblems, SceneSchema, type Scene } from '@bright-trail/shared';
import { castFrom, kidFor } from './cast';
import { DEMO_ITEMS } from './demo';
import { layoutStage, planDeal, planFill, problemFromScene } from './share';
import { keypadNarration } from './ShareItemView';

const kinds = (plan: ReturnType<typeof planDeal>) => plan.steps.map((s) => s.kind[0]).join('');
const deal = (total: number, receivers: number, label: string) =>
  planDeal(total, receivers, parseAmount(label));

describe('planDeal', () => {
  it('deals whole things one round at a time and ends fair', () => {
    const plan = deal(8, 2, '4');
    expect(plan.result).toBe('fair');
    expect(plan.steps.slice(0, 3)).toEqual([
      { kind: 'whole', thing: 0, receiver: 0, slot: 0 },
      { kind: 'whole', thing: 1, receiver: 1, slot: 0 },
      { kind: 'whole', thing: 2, receiver: 0, slot: 1 },
    ]);
  });

  it('leaves things on the plate when the amount is too small', () => {
    expect(deal(8, 2, '3')).toMatchObject({ result: 'leftover', left: { wholes: 2 } });
  });

  it('runs out when the amount is too big', () => {
    expect(deal(8, 2, '5').result).toBe('short');
  });

  it('cuts the last cookie in half to share 5 between 2', () => {
    const plan = deal(5, 2, '2 1/2');
    expect(plan.result).toBe('fair');
    expect(kinds(plan)).toBe('wwwwcpp');
  });

  it('cuts every pie into quarters to share 3 among 4', () => {
    const plan = deal(3, 4, '3/4');
    expect(plan.result).toBe('fair');
    expect(kinds(plan)).toBe('cppppcppppcpppp');
  });

  it('shows why halves fail for 3 friends: the halves run out', () => {
    // 4 sandwiches, 3 friends, 1 1/2 each: one whole each, then 2 halves for 3 friends.
    expect(deal(4, 3, '1 1/2').result).toBe('short');
  });

  it('leaves pieces over when they are too small', () => {
    // 5 cookies, 2 friends, 2 1/4 each: one quarter each, two quarters stay.
    expect(deal(5, 2, '2 1/4')).toMatchObject({
      result: 'leftover',
      left: { wholes: 0, pieces: 2, den: 4 },
    });
  });
});

describe('planFill', () => {
  it('fills one group before the next', () => {
    expect(planFill(6, 3).map((s) => s.receiver)).toEqual([0, 0, 0, 1, 1, 1]);
  });
});

describe('layoutStage', () => {
  it.each([
    [360, 420],
    [800, 300],
  ])('keeps every slot inside a %ix%i stage', (w, h) => {
    const stage = layoutStage(w, h, 12, 3, 6);
    const points = [...stage.source, ...stage.receivers.flatMap((r) => r.slots)];
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + stage.size).toBeLessThanOrEqual(w);
      expect(p.y + stage.size).toBeLessThanOrEqual(h);
    }
  });
});

describe('cast', () => {
  it("keeps the story's names and looks", () => {
    expect(kidFor({ name: 'Mia', look: 'girl' }).emoji.startsWith('👧')).toBe(true);
    expect(kidFor({ name: 'Sam', look: 'kid' }).emoji.startsWith('🧒')).toBe(true);
  });

  it('fills unnamed kids the same way every time, without repeating story names', () => {
    const a = castFrom('item-1', ['Maya']);
    const b = castFrom('item-1', ['Maya']);
    const first = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(first);
    expect(first.map((k) => k.name)).not.toContain('Maya');
    expect(new Set(first.map((k) => k.name)).size).toBe(3);
  });

  it('builds receivers for kids, containers, and stores', () => {
    const scene = (receivers: Scene['receivers']): Scene =>
      SceneSchema.parse({
        kind: 'share',
        ask: 'each',
        thing: 'cookie',
        one: 'cookie',
        many: 'cookies',
        container: 'plate',
        receivers,
        total: 6,
        groups: 2,
        named: receivers === 'kids' ? [{ name: 'Ana', look: 'girl' }] : undefined,
      });
    expect(problemFromScene(scene('kids'), 's').side.receivers[0].name).toBe('Ana');
    expect(problemFromScene(scene('containers'), 's').side.receivers).toEqual([{}, {}]);
    expect(problemFromScene(scene('stores'), 's').side.receivers[0]).toEqual({ emoji: '🏪' });
  });
});

describe('demo items', () => {
  it.each(DEMO_ITEMS.map((i) => [i.id, i] as const))('%s matches its scene', (_, item) => {
    expect(sceneProblems(item, item.scene!)).toEqual([]);
  });
});

describe('keypadNarration', () => {
  it('turns frog moves into typing', () => {
    expect(keypadNarration('Hop the frog to how many grapes each friend gets.')).toBe(
      'Type how many grapes each friend gets.',
    );
  });
});
