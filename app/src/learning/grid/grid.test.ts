import type { GridScene } from '@bright-trail/shared';
import { GRID_DEMO_ITEMS } from './demo';
import {
  decimalLabels,
  filledBoxes,
  filledCells,
  fillSteps,
  layoutOf,
  STAGE_H,
  STAGE_W,
} from './layout';
import { gridShout, gridWords, lineQuestion } from './words';

const demo = (id: string) => {
  const game = GRID_DEMO_ITEMS.find((i) => i.id === `demo-grid-${id}`)!.game;
  if (game?.kind !== 'grid') throw new Error(`demo-grid-${id} has no grid game`);
  return game;
};
const scene = (s: Omit<GridScene, 'kind'>): GridScene => ({ kind: 'grid', ...s });

const inside = (s: GridScene) => {
  for (const g of layoutOf(s).groups) {
    for (const w of g.wholes) {
      expect(w.x).toBeGreaterThanOrEqual(0);
      expect(w.y).toBeGreaterThanOrEqual(g.card.y);
      expect(w.x + w.w).toBeLessThanOrEqual(STAGE_W);
      expect(g.count.y).toBeLessThanOrEqual(STAGE_H);
    }
    expect(g.card.y).toBeGreaterThanOrEqual(0);
  }
};

describe('layoutOf', () => {
  it('stacks a strip per whole, and fills it left to right', () => {
    const l = layoutOf(demo('wholes'));
    expect(l.groups).toHaveLength(1);
    const [g] = l.groups;
    expect(g.wholes).toHaveLength(3);
    expect(g.fill).toBe(27);
    const cells = filledCells(g, 27);
    expect(cells[1].x).toBeGreaterThan(cells[0].x);
    expect(cells[10].y).toBeGreaterThan(cells[9].y);
    expect(filledBoxes(g, 27).map((b) => b.w / 30)).toEqual([10, 10, 7]);
  });

  it('fills a hundred grid a column at a time', () => {
    const [g] = layoutOf(demo('parts')).groups;
    expect(g.wholes).toHaveLength(1);
    const cells = filledCells(g, 30);
    expect(cells[9].x).toBe(cells[0].x);
    expect(cells[10].x).toBeGreaterThan(cells[0].x);
    const [h] = layoutOf(scene({ unit: 'hundredths', ask: 'decimal', amount: '0.34' })).groups;
    expect(filledBoxes(h, 34)).toEqual([
      { x: g.wholes[0].x, y: g.wholes[0].y, w: 3 * cells[0].size, h: g.wholes[0].h },
      {
        x: g.wholes[0].cells[30].x,
        y: g.wholes[0].cells[30].y,
        w: cells[0].size,
        h: 4 * cells[0].size,
      },
    ]);
    expect(fillSteps('hundredths', 75)).toEqual([10, 20, 30, 40, 50, 60, 70, 71, 72, 73, 74, 75]);
    expect(fillSteps('tenths', 3)).toEqual([1, 2, 3]);
  });

  it('keeps every picture on the stage', () => {
    inside(demo('same'));
    inside(scene({ unit: 'tenths', ask: 'decimal', amount: '3.5' }));
    inside(scene({ unit: 'tenths', ask: 'same', amount: '2.0', other: '2' }));
    inside(scene({ unit: 'hundredths', ask: 'same', amount: '1 1/4', other: '1.25' }));
  });
});

describe('gridWords', () => {
  it('says what the play-out showed', () => {
    expect(gridWords(demo('decimal'))).toBe("We filled 9 tenths. As a decimal, that's 0.9.");
    expect(gridWords(demo('fraction'))).toBe("We filled 4 tenths. As a fraction, that's 4/10.");
    expect(gridWords(scene({ unit: 'tenths', ask: 'fraction', amount: '1/2' }))).toBe(
      "We filled 5 tenths. As a fraction, that's 5/10, the same as 1/2.",
    );
    expect(gridWords(demo('percent'))).toBe(
      "We filled 75 hundredths. That's 75 out of 100, or 75%.",
    );
    expect(gridWords(demo('parts'))).toBe('0.3 fills 30 hundredths.');
    expect(gridWords(demo('same'))).toBe(
      '7/10 fills 70 hundredths, but 0.07 fills 7 hundredths. They are not the same.',
    );
    expect(gridShout(demo('wholes'))).toBe('27 tenths = 2.7');
  });
});

describe('decimalLabels', () => {
  it('shows number choices as decimals', () => {
    const item = GRID_DEMO_ITEMS.find((i) => i.id === 'demo-grid-decimal-choices')!;
    const input = decimalLabels(
      {
        kind: 'choices',
        choices: [
          { id: 'a', label: '1/2', value: 0.5 },
          { id: 'b', label: '1/5', value: 0.2 },
        ],
      },
      item,
    );
    expect(input.kind === 'choices' && input.choices.map((c) => c.label)).toEqual(['0.5', '0.2']);
  });
});

describe('lineQuestion', () => {
  it('asks a number-line item on the keypad, without the frog', () => {
    expect(lineQuestion(demo('line'))).toEqual({
      prompt: '3/10 = ?',
      question: 'What is 3/10 as a decimal? Type it.',
    });
    expect(lineQuestion(scene({ unit: 'hundredths', ask: 'percent', amount: '7/20' }))).toEqual({
      prompt: '7/20 = ?%',
      question: 'What is 7/20 as a percent? Type it.',
    });
  });
});
