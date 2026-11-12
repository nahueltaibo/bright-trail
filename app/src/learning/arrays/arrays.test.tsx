import type { ArrayScene } from '@bright-trail/shared';
import { act, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { ArraysStage, type ArraysStageHandle } from './ArraysStage';
import { ARRAYS_DEMO_ITEMS } from './demo';
import { layoutOf, STAGE_H, STAGE_W, turned } from './layout';
import { arrayWords, factLine } from './words';

const demo = (id: string) => {
  const game = ARRAYS_DEMO_ITEMS.find((i) => i.id === `demo-arrays-${id}`)!.game;
  if (game?.kind !== 'arrays') throw new Error(`demo-arrays-${id} has no arrays game`);
  return game;
};
const scene = (s: Omit<ArrayScene, 'kind'>): ArrayScene => ({ kind: 'arrays', ...s });

describe('layoutOf', () => {
  it('keeps every demo array, turned or split, on the stage', () => {
    for (const item of ARRAYS_DEMO_ITEMS) {
      const s = item.game as ArrayScene;
      const l = layoutOf(s);
      expect(l.cells).toHaveLength(s.rows * s.columns);
      for (const cell of l.cells) {
        for (const p of [cell.at, cell.apart, turned(cell.at, l.center, 1)]) {
          expect(p.x - l.cell / 2).toBeGreaterThanOrEqual(0);
          expect(p.x + l.cell / 2).toBeLessThanOrEqual(STAGE_W);
          expect(p.y - l.cell / 2).toBeGreaterThanOrEqual(0);
          expect(p.y + l.cell / 2).toBeLessThanOrEqual(STAGE_H);
        }
      }
    }
  });

  it('deals a columns ask one per row at a time', () => {
    const l = layoutOf(demo('columns'));
    expect(l.cells.slice(0, 7).map((c) => [c.row, c.column])).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
      [4, 0],
      [5, 0],
      [0, 1],
    ]);
  });

  it('turns 3 rows of 5 into 5 rows of 3', () => {
    const l = layoutOf(demo('turn'));
    const ends = l.cells.map((c) => turned(c.at, l.center, 1));
    const rows = new Set(ends.map((p) => Math.round(p.y)));
    const columns = new Set(ends.map((p) => Math.round(p.x)));
    expect([rows.size, columns.size]).toEqual([5, 3]);
  });

  it('pulls a split into its two parts', () => {
    const l = layoutOf(demo('split'));
    expect(l.cells.filter((c) => c.part === 0)).toHaveLength(40);
    expect(l.cells.filter((c) => c.part === 1)).toHaveLength(16);
    const right = l.cells.find((c) => c.part === 1)!;
    expect(right.apart.x).toBeGreaterThan(right.at.x);
  });
});

describe('arrayWords', () => {
  it('counts by the row size, turns, and adds the parts', () => {
    expect(arrayWords(demo('total'))).toBe('3 rows of 4 make 12. Count by 4s: 4, 8, 12.');
    expect(arrayWords(demo('columns'))).toBe(
      '24 in 6 rows makes 4 in each row, because 6 × 4 = 24.',
    );
    expect(arrayWords(demo('turn'))).toBe(
      '3 rows of 5 turn into 5 rows of 3. Both make 15, so 3 × 5 = 5 × 3.',
    );
    expect(arrayWords(demo('split'))).toBe(
      '8 × 7 splits into 8 × 5 = 40 and 8 × 2 = 16. 40 + 16 = 56.',
    );
    expect(arrayWords(scene({ ask: 'total', rows: 1, columns: 6 }))).toBe(
      '1 row of 6 makes 6. Count by 6s: 6.',
    );
  });

  it('hides the answer in the fact line until the play-out', () => {
    expect(factLine(demo('rows'), false)).toBe('12 in all');
    expect(factLine(demo('rows'), true)).toBe('3 × 4 = 12');
    expect(factLine(demo('split'), true)).toBe('40 + 16 = 56');
  });
});

describe('ArraysStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const mount = async (s: ArrayScene) => {
    const handle = createRef<ArraysStageHandle>();
    await render(<ArraysStage scene={s} handle={handle} />);
    await act(async () => {
      screen.getByTestId('arrays-stage').props.onLayout({
        nativeEvent: { layout: { width: STAGE_W, height: STAGE_H } },
      });
    });
    return handle;
  };
  const play = async (handle: ReturnType<typeof createRef<ArraysStageHandle>>) => {
    await act(async () => {
      const done = handle.current!.play();
      await jest.runAllTimersAsync();
      await done;
    });
  };

  it('starts a rows ask empty, then fills a row of 4 at a time to 3 rows', async () => {
    const handle = await mount(demo('rows'));
    expect(screen.queryAllByTestId('arrays-thing')).toHaveLength(0);
    await play(handle);
    expect(screen.getAllByTestId('arrays-thing')).toHaveLength(12);
    expect(screen.getAllByTestId('arrays-row-label').map((l) => l.props.children)).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(screen.getByText('3 rows!')).toBeTruthy();
    await act(async () => {
      const reset = handle.current!.reset();
      await jest.runAllTimersAsync();
      await reset;
    });
    expect(screen.queryAllByTestId('arrays-thing')).toHaveLength(0);
  });

  it('shows a total ask whole, then counts it by rows', async () => {
    const handle = await mount(demo('total'));
    expect(screen.getAllByTestId('arrays-thing')).toHaveLength(12);
    await play(handle);
    expect(screen.getAllByTestId('arrays-row-label').map((l) => l.props.children)).toEqual([
      '4',
      '8',
      '12',
    ]);
    expect(screen.getByText('3 × 4 = 12')).toBeTruthy();
  });

  it('labels the parts of a split', async () => {
    const handle = await mount(demo('split'));
    await play(handle);
    expect(screen.getAllByTestId('arrays-part').map((l) => l.props.children)).toEqual([
      '8 × 5',
      '8 × 2',
    ]);
  });
});
