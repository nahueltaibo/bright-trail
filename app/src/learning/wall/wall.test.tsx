import type { WallScene } from '@bright-trail/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ItemView } from '../ItemView';
import { WALL_DEMO_ITEMS } from './demo';
import { countAt, wallWholesFor } from './layout';
import { wallHint, wallNarration, wallNote, wallWords } from './words';

const item = (id: string) => WALL_DEMO_ITEMS.find((i) => i.id === `demo-wall-${id}`)!;
const demo = (id: string) => {
  const game = item(id).game;
  if (game?.kind !== 'wall') throw new Error(`demo-wall-${id} has no wall game`);
  return game;
};

describe('countAt', () => {
  it('fills to the tapped piece, and a tap on the last one takes it away', () => {
    expect(countAt(10, 120, 4, 'tap', 0)).toBe(1);
    expect(countAt(61, 120, 4, 'tap', 0)).toBe(3);
    expect(countAt(61, 120, 4, 'tap', 3)).toBe(2);
    expect(countAt(-5, 120, 4, 'tap', 0)).toBe(1);
  });

  it('snaps a drag to the nearest edge, so thin twelfths need no aim', () => {
    expect(countAt(199, 300, 12, 'drag', 0)).toBe(8);
    expect(countAt(212, 300, 12, 'drag', 0)).toBe(8);
    expect(countAt(0, 300, 12, 'drag', 5)).toBe(0);
    expect(countAt(400, 300, 12, 'drag', 5)).toBe(12);
  });
});

describe('wallWholesFor', () => {
  it('makes room for the answer and every choice', () => {
    expect(wallWholesFor(demo('fill'), [])).toBe(1);
    expect(wallWholesFor(demo('fill-wholes'), [])).toBe(2);
    expect(wallWholesFor(demo('more'), ['No', 'Yes'])).toBe(2);
    expect(wallWholesFor(demo('match'), ['7/3', '5/3', '2/3', '8/3'])).toBe(3);
  });
});

describe('wall words', () => {
  it('turns keypad words into the build', () => {
    expect(wallNarration(item('fill').narration, demo('fill'))).toBe(
      'The fraction 1/2 is equivalent to a fraction with 4 as the denominator. Fill the fourths up to the dashed line.',
    );
    const pass: WallScene = { kind: 'wall', ask: 'pass', than: '1/2', parts: 6 };
    expect(wallNarration('Type the numerator.', pass)).toBe(
      'Fill the sixths just past the dashed line.',
    );
    expect(wallNarration(item('more').narration, demo('more'))).toBe(item('more').narration);
    expect(wallHint(demo('fill-wholes'))).toBe(
      'Tap or slide along the wholes. Fill them to the dashed line.',
    );
  });

  it('says which edge reaches further', () => {
    expect(wallNote('3/8', '1/2')).toBe('1/2 reaches further than 3/8.');
    expect(wallNote('2/4', '1/2')).toBe('2/4 and 1/2 end at the same edge.');
    expect(wallWords(demo('fill'), { mine: '2/4', lower: '2/4' }, true, 'Why.')).toEqual({
      feedback: '2/4 and 1/2 end at the same edge.',
      note: null,
    });
    expect(wallWords(demo('fill'), { mine: '3/4', lower: '3/4' }, false, 'Why.')).toEqual({
      feedback: 'Why.',
      note: '3/4 reaches further than 1/2.',
    });
    expect(wallWords(demo('fill'), { mine: '3/4', lower: '2/4' }, false, 'Why.')).toEqual({
      feedback: 'Why.',
      note: 'You made 3/4. The wall shows 2/4.',
    });
  });
});

/** Lays the stage out at phone size, then runs timers until `text` shows. */
async function playUntil(text: string) {
  for (let i = 0; i < 200 && screen.queryByText(text) === null; i++) {
    await act(async () => {
      jest.advanceTimersByTime(100);
    });
  }
  expect(screen.getByText(text)).toBeTruthy();
}

async function lay() {
  await act(async () => {
    screen
      .getByTestId('wall-stage')
      .props.onLayout({ nativeEvent: { layout: { width: 344, height: 300 } } });
  });
}

describe('WallGame', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('builds an equal fraction and checks it in place of the keypad', async () => {
    const onAnswer = jest.fn();
    await render(<ItemView item={item('fill')} onAnswer={onAnswer} shuffleSeed="test" />);
    await lay();
    expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.getByTestId('wall-guide')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Check my answer' })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'One piece more' }));
    await fireEvent.press(screen.getByRole('button', { name: 'One piece more' }));
    expect(screen.getAllByText('2/4').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByRole('button', { name: 'Check my answer' }));
    await playUntil('Yes! Great job!');
    expect(screen.getByText('2/4 and 1/2 end at the same edge.')).toBeTruthy();
    expect(screen.getByTestId('wall-same')).toBeTruthy();
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 2, correct: true }));
  });

  it('offers another try after a wrong build in practice', async () => {
    await render(<ItemView item={item('fill')} shuffleSeed="test" />);
    await lay();
    for (let i = 0; i < 3; i++) {
      await fireEvent.press(screen.getByRole('button', { name: 'One piece more' }));
    }
    await fireEvent.press(screen.getByRole('button', { name: 'Check my answer' }));
    await playUntil('Good try!');
    expect(screen.getByText(/^3\/4 reaches further than 1\/2\./)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    await playUntil('Tap or slide along the fourths. Fill them to the dashed line.');
    expect(screen.getByRole('button', { name: 'Check my answer' })).toBeDisabled();
  });

  it('moves a wrong build to the right one and on when measuring', async () => {
    await render(<ItemView item={item('fill')} measuring shuffleSeed="test" />);
    await lay();
    await fireEvent.press(screen.getByRole('button', { name: 'One piece more' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Check my answer' }));
    await playUntil('Good try!');
    expect(screen.getByText(/^You made 1\/4\. The wall shows 2\/4\./)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Next' })).toBeTruthy();
  });

  it('fills a compare after the answer, not before', async () => {
    await render(<ItemView item={item('relation')} shuffleSeed="test" />);
    await lay();
    expect(screen.queryByText('3/8')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'less than 1/2' }));
    await playUntil('Yes! Great job!');
    expect(screen.getByText('1/2 reaches further than 3/8.')).toBeTruthy();
    expect(screen.getByText('3/8')).toBeTruthy();
  });

  it('shows the picked choice against the fraction it should match', async () => {
    await render(<ItemView item={item('match')} shuffleSeed="test" />);
    await lay();
    await fireEvent.press(screen.getByRole('button', { name: '8/3' }));
    await playUntil('Good try!');
    expect(screen.getAllByText(/8\/3 reaches further than 2 1\/3\./).length).toBeGreaterThan(0);
  });
});
