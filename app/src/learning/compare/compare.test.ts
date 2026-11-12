import type { CompareScene } from '@bright-trail/shared';
import { COMPARE_DEMO_ITEMS } from './demo';
import { layoutOf, lineOf, niceStep, sceneLabels } from './layout';
import { compareWords } from './words';

const demo = (id: string) => {
  const game = COMPARE_DEMO_ITEMS.find((i) => i.id === `demo-compare-${id}`)!.game;
  if (game?.kind !== 'compare') throw new Error(`demo-compare-${id} has no compare game`);
  return game;
};
const scene = (s: Omit<CompareScene, 'kind'>): CompareScene => ({ kind: 'compare', ...s });

describe('lineOf', () => {
  it('steps whole numbers and decimals by 1, 2, or 5 times a power of ten', () => {
    expect(niceStep(33)).toBe(5);
    expect(niceStep(0.54)).toBe(0.1);
    expect(lineOf(['87', '120'])).toEqual({ min: 85, max: 120, step: 5 });
    expect(lineOf(['2.45', '2.54', '2.4'])).toEqual({ min: 2.4, max: 2.54, step: 0.02 });
    expect(lineOf(['0.6', '0.06'])).toEqual({ min: 0, max: 0.6, step: 0.1 });
  });

  it('steps fractions by their common unit, or by halves when that crowds the line', () => {
    expect(lineOf(['3/8', '5/8'])).toEqual({ min: 0, max: 1, step: 1 / 8 });
    expect(lineOf(['3/8', '5/6'])).toEqual({ min: 0, max: 1, step: 0.5 });
    expect(lineOf(['1 1/2', '4/5', '7/4'])).toEqual({ min: 0, max: 2, step: 0.5 });
  });
});

describe('layoutOf', () => {
  it('stands whole numbers to 20 as towers, tallest cube size first', () => {
    const l = layoutOf(demo('towers'));
    if (l.view !== 'towers') throw new Error('expected towers');
    expect(l.towers.map((t) => t.value)).toEqual([9, 12]);
    expect(l.winner).toBe(1);
    expect(l.cube * 12).toBeLessThanOrEqual(186);
  });

  it('puts bigger values farther right, and staggers flags that crowd', () => {
    const l = layoutOf(demo('line'));
    if (l.view !== 'line') throw new Error('expected a line');
    const [f899, f989, f898, f998] = l.flags;
    expect(f898.x).toBeLessThan(f899.x);
    expect(f899.x).toBeLessThan(f989.x);
    expect(f989.x).toBeLessThan(f998.x);
    expect(f898.height).not.toBe(f899.height);
    expect(l.winner).toBe(3);
    expect(l.ticks[0].label).toBe('890');
    expect(l.ticks.at(-1)?.label).toBe('1000');
  });

  it('places the target of a closer ask on the line', () => {
    const l = layoutOf(demo('closer'));
    if (l.view !== 'line') throw new Error('expected a line');
    expect(l.target?.x).toBeGreaterThan(l.flags[0].x);
    expect(l.target?.x).toBeLessThan(l.flags[1].x);
    expect(l.flags[1].x - l.target!.x).toBeLessThan(l.target!.x - l.flags[0].x);
  });
});

describe('sceneLabels', () => {
  it('labels choices the way the scene writes them', () => {
    const input = sceneLabels(
      {
        kind: 'choices',
        choices: [
          { id: 'a', label: '3/5', value: 0.6 },
          { id: 'b', label: '0.06', value: 0.06 },
        ],
      },
      demo('decimals'),
    );
    expect(input.kind === 'choices' && input.choices.map((c) => c.label)).toEqual(['0.6', '0.06']);
  });
});

describe('compareWords', () => {
  it('says what the play-out showed', () => {
    expect(compareWords(demo('towers'))).toBe('12 makes the taller tower, so 12 is greater.');
    expect(compareWords(demo('towers-least'))).toBe('3 makes the shortest tower, so 3 is least.');
    expect(compareWords(demo('fractions'))).toBe(
      '3/8 is farther left on the number line, so 3/8 is less.',
    );
    expect(compareWords(demo('middle'))).toBe(
      'In order, they go 87, 120, 150. 120 is in the middle.',
    );
    expect(compareWords(demo('closer'))).toBe(
      '190 is 90 from 100 and 10 from 200, so it is closer to 200.',
    );
    expect(compareWords(scene({ ask: 'closer', values: ['0', '1'], target: '3/4' }))).toBe(
      '3/4 is 3/4 from 0 and 1/4 from 1, so it is closer to 1.',
    );
  });
});
