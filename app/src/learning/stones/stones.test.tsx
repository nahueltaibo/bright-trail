import type { StonesScene } from '@bright-trail/shared';
import { act, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { STONES_DEMO_ITEMS } from './demo';
import { layoutOf, STAGE_W } from './layout';
import { StonesStage, type StonesStageHandle } from './StonesStage';
import { stonesWords } from './words';

const demo = (id: string) => {
  const game = STONES_DEMO_ITEMS.find((i) => i.id === `demo-stones-${id}`)!.game;
  if (game?.kind !== 'stones') throw new Error(`demo-stones-${id} has no stones game`);
  return game;
};

describe('layoutOf', () => {
  it('spaces stones evenly right of the bank and marks the missing one', () => {
    const l = layoutOf(demo('next'));
    const xs = l.stones.map((s) => s.x);
    expect(xs[1] - xs[0]).toBeCloseTo(xs[3] - xs[2]);
    expect(l.stones.map((s) => s.missing)).toEqual([false, false, false, true]);
    expect(l.hop).toBe('+2');
  });

  it('fits eight stones on the stage with room between them', () => {
    const l = layoutOf(demo('long'));
    expect(l.stones.at(-1)!.x + l.size / 2).toBeLessThanOrEqual(STAGE_W);
    expect(l.stones[1].x - l.stones[0].x).toBeGreaterThan(l.size);
  });

  it('writes fraction and backward hops like the stones', () => {
    expect(layoutOf(demo('thirds')).hop).toBe('+1/3');
    expect(layoutOf(demo('down')).hop).toBe('−1');
  });
});

describe('stonesWords', () => {
  it('reaches the missing stone from its neighbour', () => {
    expect(stonesWords(demo('next'))).toBe('Each hop adds 2. 6 and 2 more is 8.');
    expect(stonesWords(demo('down'))).toBe('Each hop takes away 1. 1 less than 5 is 4.');
    expect(stonesWords(demo('before'))).toBe('Each hop adds 2. 2 less than 50 is 48.');
    expect(stonesWords(demo('thirds'))).toBe('Each hop adds 1/3. 2/3 and 1/3 more is 3/3.');
    const down: StonesScene = { kind: 'stones', stones: ['10', '9', '8'], missing: 0 };
    expect(stonesWords(down)).toBe('Each hop takes away 1. 9 and 1 more is 10.');
  });
});

describe('StonesStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('hides the missing number until the frog lands, then shows it again after reset', async () => {
    const handle = createRef<StonesStageHandle>();
    await render(<StonesStage scene={demo('next')} handle={handle} />);
    await act(async () => {
      screen.getByTestId('stones-stage').props.onLayout({
        nativeEvent: { layout: { width: 360, height: 290 } },
      });
    });
    expect(screen.getByTestId('stones-missing').props.children).toBe('?');

    let done = false;
    await act(async () => {
      void handle.current!.play().then(() => (done = true));
    });
    while (!done) {
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    expect(screen.getByTestId('stones-missing').props.children).toBe('8');
    expect(screen.getByText('+2 each hop!')).toBeTruthy();

    await act(async () => {
      const r = handle.current!.reset();
      jest.advanceTimersByTime(100);
      await r;
    });
    expect(screen.getByTestId('stones-missing').props.children).toBe('?');
  });
});
