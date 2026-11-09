import { defaultHops, hopsProblems, type NumberLineItem } from '@bright-trail/shared';
import { HOPS_DEMO_ITEMS } from './hopsDemo';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { NumberLineItemView } from './NumberLineItemView';
import { indexAtFraction, indexOfValue, labelEvery, stepCount, valueAt } from './numberLine';
import { findTwelve } from './testing';

const tenths = { min: 0, max: 1, step: 0.1 };
const WIDTH = 400;

async function layOut() {
  await fireEvent(screen.getByTestId('number-line-track'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: WIDTH, height: 150 } },
  });
}

/** A touch at `x` within the track, with the track starting at page x 50. */
function touch(x: number) {
  return { nativeEvent: { locationX: x, pageX: 50 + x, locationY: 40, pageY: 40 } };
}

describe('number line math', () => {
  it('snaps fractions to the nearest step and clamps', () => {
    expect(indexAtFraction(0.62, findTwelve)).toBe(12);
    expect(indexAtFraction(0.58, findTwelve)).toBe(12);
    expect(indexAtFraction(-0.3, findTwelve)).toBe(0);
    expect(indexAtFraction(1.4, findTwelve)).toBe(20);
  });

  it('gives exact values on decimal steps', () => {
    expect(stepCount(tenths)).toBe(10);
    expect(valueAt(3, tenths)).toBe(0.3);
    expect(valueAt(7, tenths)).toBe(0.7);
    expect(indexOfValue(0.3, tenths)).toBe(3);
    expect(valueAt(indexAtFraction(0.29, tenths), tenths)).toBe(0.3);
    expect(valueAt(2, { min: 1.5, max: 3, step: 0.25 })).toBe(2);
  });

  it('labels a busy line sparsely', () => {
    expect(labelEvery(10)).toBe(1);
    expect(labelEvery(20)).toBe(2);
    expect(labelEvery(50)).toBe(5);
    expect(labelEvery(100)).toBe(10);
  });
});

describe('NumberLineItemView', () => {
  it('waits for the frog to be placed before checking', async () => {
    const narrate = jest.fn();
    await render(<NumberLineItemView item={findTwelve} narrate={narrate} />);
    expect(narrate).toHaveBeenCalledWith([findTwelve.narration]);
    expect(screen.getByLabelText('Check my answer')).toBeDisabled();
  });

  it('places the frog where the child taps, snapped to a step', async () => {
    // A laid-out line plays the hops, so keep its frames off the real clock.
    jest.useFakeTimers();
    try {
      const onAnswer = jest.fn();
      const item: NumberLineItem = { ...findTwelve, target: 10 };
      await render(<NumberLineItemView item={item} onAnswer={onAnswer} />);
      await layOut();

      await fireEvent(screen.getByTestId('number-line-track'), 'responderGrant', touch(WIDTH / 2));
      expect(screen.getByTestId('number-line-track')).toHaveAccessibilityValue({ text: '10' });
      await fireEvent.press(screen.getByLabelText('Check my answer'));

      expect(onAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ itemId: item.id, answer: 10, correct: true }),
      );
      await act(() => jest.advanceTimersByTimeAsync(10_000));
    } finally {
      jest.useRealTimers();
    }
  });

  it('follows a drag, reports a miss at once, and shows why after the frog hops', async () => {
    jest.useFakeTimers();
    try {
      const onAnswer = jest.fn();
      await render(<NumberLineItemView item={findTwelve} onAnswer={onAnswer} />);
      await layOut();
      const track = screen.getByTestId('number-line-track');

      await fireEvent(track, 'responderGrant', touch(0));
      expect(track).toHaveAccessibilityValue({ text: '0' });
      // Past the right end: clamps to max.
      await fireEvent(track, 'responderMove', touch(WIDTH + 80));
      expect(track).toHaveAccessibilityValue({ text: '20' });
      await fireEvent.press(screen.getByLabelText('Check my answer'));

      expect(onAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ answer: 20, correct: false }),
      );
      expect(screen.queryByText(findTwelve.why)).toBeNull();

      // 12 on a line of 20 is a hop of 10, then 2 of 1.
      await act(() => jest.advanceTimersByTimeAsync(10_000));
      expect(screen.getByText('+10')).toBeTruthy();
      expect(screen.getByText('It lands on 12')).toBeTruthy();
      expect(screen.getByLabelText('The answer is 12')).toBeTruthy();
      expect(screen.getByText(findTwelve.why)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('starts a planned path where the story starts', async () => {
    jest.useFakeTimers();
    try {
      const item: NumberLineItem = {
        ...findTwelve,
        target: 14,
        hops: { start: 20, legs: [{ by: -1, times: 6 }] },
      };
      await render(<NumberLineItemView item={item} />);
      await layOut();
      await fireEvent(screen.getByTestId('number-line-track'), 'responderGrant', touch(0));
      await fireEvent.press(screen.getByLabelText('Check my answer'));
      await act(() => jest.advanceTimersByTimeAsync(10_000));
      expect(screen.getByText('6 hops of −1')).toBeTruthy();
      expect(screen.getByText('It lands on 14')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('labels a line of quarters in fourths', async () => {
    const item: NumberLineItem = { ...findTwelve, min: 0, max: 1, step: 0.25, target: 0.75 };
    await render(<NumberLineItemView item={item} />);
    expect(screen.getByText('3/4')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
  });

  it('nudges with the arrow buttons and screen-reader actions', async () => {
    const onAnswer = jest.fn();
    await render(<NumberLineItemView item={findTwelve} onAnswer={onAnswer} />);
    const track = screen.getByTestId('number-line-track');

    await fireEvent.press(screen.getByLabelText('Move right'));
    expect(track).toHaveAccessibilityValue({ text: '0' });
    await fireEvent.press(screen.getByLabelText('Move right'));
    await fireEvent.press(screen.getByLabelText('Move left'));
    await fireEvent.press(screen.getByLabelText('Move left'));
    expect(track).toHaveAccessibilityValue({ text: '0' });

    for (let i = 0; i < 12; i++) {
      await fireEvent(track, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    }
    await fireEvent.press(screen.getByLabelText('Check my answer'));
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 12, correct: true }));
  });

  it('answers with exact decimals on a 0.1 step line', async () => {
    const onAnswer = jest.fn();
    const item: NumberLineItem = { ...findTwelve, ...tenths, target: 0.3 };
    await render(<NumberLineItemView item={item} onAnswer={onAnswer} />);
    const track = screen.getByTestId('number-line-track');

    for (let i = 0; i < 3; i++) await fireEvent.press(screen.getByLabelText('Move right'));
    // The first nudge places the frog at 0, so three nudges land on 0.2.
    expect(track).toHaveAccessibilityValue({ text: '0.2' });
    await fireEvent.press(screen.getByLabelText('Move right'));
    await fireEvent.press(screen.getByLabelText('Check my answer'));

    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 0.3, correct: true }));
  });

  it('ignores touches once answered', async () => {
    const onAnswer = jest.fn();
    await render(<NumberLineItemView item={findTwelve} onAnswer={onAnswer} />);
    await layOut();
    const track = screen.getByTestId('number-line-track');
    await fireEvent(track, 'responderGrant', touch(WIDTH / 2));
    await fireEvent.press(screen.getByLabelText('Check my answer'));

    await fireEvent(track, 'responderGrant', touch(0));
    expect(track).toHaveAccessibilityValue({ text: '10' });
    expect(onAnswer).toHaveBeenCalledTimes(1);
  });
});

describe('hops demo items', () => {
  it.each(HOPS_DEMO_ITEMS.map((i) => [i.id, i] as const))('%s lands on its answer', (_, item) => {
    if (item.type !== 'number-line') throw new Error('not a number line');
    expect(hopsProblems(item, item.hops ?? defaultHops(item))).toEqual([]);
  });
});
