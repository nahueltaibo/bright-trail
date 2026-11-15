import type { LineupScene } from '@bright-trail/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { createRef } from 'react';
import { ItemView } from '../ItemView';
import { LINEUP_DEMO_ITEMS } from './demo';
import { findQuestion, lineupWords, slotsOf, whoOf } from './layout';
import { LineupStage, type LineupStageHandle } from './LineupStage';

const demo = (id: string) => LINEUP_DEMO_ITEMS.find((i) => i.id === `demo-lineup-${id}`)!;
const sceneOf = (id: string) => {
  const game = demo(id).game;
  if (game?.kind !== 'lineup') throw new Error(`demo-lineup-${id} has no line-up`);
  return game;
};

describe('line-up words', () => {
  it('names the one asked about by name, kind, or place', () => {
    expect(whoOf(sceneOf('name'))).toBe('Ana');
    expect(whoOf(sceneOf('choices'))).toBe('the cat');
    expect(whoOf(sceneOf('find'))).toBe('the third frog');
    expect(whoOf(sceneOf('last'))).toBe('the last duck');
  });

  it('swaps the hop for a tap', () => {
    expect(findQuestion(demo('find'), sceneOf('find'))).toBe(
      'A frog is third in line. Tap the third frog.',
    );
    expect(findQuestion(demo('name'), sceneOf('name'))).toBe('Ana is seventh in line. Tap Ana.');
  });

  it('counts up to the place for the feedback', () => {
    expect(lineupWords(sceneOf('choices'))).toBe('First, second. The cat is in place 2.');
    expect(lineupWords(sceneOf('last'))).toBe(
      'First, second, … fifth. The last duck is in place 5.',
    );
  });

  it('gives every place a full-height column across the stage', () => {
    const eight: LineupScene = sceneOf('name');
    const { slot, art, x } = slotsOf(eight, 344);
    expect(x(7) + slot).toBeLessThanOrEqual(344);
    expect(art).toBeLessThan(slot);
  });
});

describe('LineupStage', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const finish = async (run: () => Promise<void>) => {
    let done = false;
    await act(async () => {
      void run().then(() => (done = true));
    });
    while (!done) {
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
  };

  it('counts each place aloud as the line walks in, then fades the badges', async () => {
    const said: string[] = [];
    const handle = createRef<LineupStageHandle>();
    await render(
      <LineupStage scene={sceneOf('find')} handle={handle} narrate={(t) => said.push(...t)} />,
    );
    await act(async () => {
      screen.getByTestId('lineup-stage').props.onLayout({
        nativeEvent: { layout: { width: 344, height: 260 } },
      });
    });
    await finish(() => handle.current!.lineUp());
    expect(said).toEqual(['first', 'second', 'third', 'fourth', 'fifth']);
    // The badges fade before the question, so they don't give the answer away.
    expect(screen.queryByTestId('lineup-badge-1')).toBeNull();

    said.length = 0;
    await finish(() => handle.current!.play(4));
    expect(said).toEqual(['first', 'second', 'third']);
    expect(screen.getByText('3rd')).toBeTruthy();
    expect(screen.queryByTestId('lineup-badge-4')).toBeNull();

    await finish(() => handle.current!.reset());
    expect(screen.queryByTestId('lineup-badge-1')).toBeNull();
  });

  it('takes taps only while the child can answer, and fades tried places', async () => {
    const taps: number[] = [];
    const scene = sceneOf('find');
    const { rerender } = await render(<LineupStage scene={scene} />);
    await act(async () => {
      screen.getByTestId('lineup-stage').props.onLayout({
        nativeEvent: { layout: { width: 344, height: 260 } },
      });
    });
    expect(screen.getByTestId('lineup-place-3').props.accessibilityState.disabled).toBe(true);
    await rerender(<LineupStage scene={scene} onTap={(p) => taps.push(p)} tried={[4]} />);
    fireEvent.press(screen.getByTestId('lineup-place-3'));
    fireEvent.press(screen.getByTestId('lineup-place-4'));
    expect(taps).toEqual([3]);
  });
});

describe('LineupGame', () => {
  it('asks to tap after the line-up and reports the tapped place', async () => {
    jest.useFakeTimers();
    const answers: { answer: string | number; correct: boolean }[] = [];
    await render(
      <ItemView item={demo('find')} shuffleSeed="test" onAnswer={(r) => answers.push(r)} />,
    );
    expect(screen.getByText('Tap one in the line')).toBeTruthy();
    await act(async () => {
      screen.getByTestId('lineup-stage').props.onLayout({
        nativeEvent: { layout: { width: 344, height: 260 } },
      });
    });
    // Taps wait for the line to finish walking in.
    fireEvent.press(screen.getByTestId('lineup-place-3'));
    expect(answers).toEqual([]);
    for (let t = 0; t < 8000; t += 100) {
      await act(async () => {
        jest.advanceTimersByTime(100);
      });
    }
    fireEvent.press(screen.getByTestId('lineup-place-4'));
    expect(answers).toMatchObject([{ answer: 4, correct: false }]);
    jest.useRealTimers();
  });
});
