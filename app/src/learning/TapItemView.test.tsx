import { fireEvent, render, screen } from '@testing-library/react-native';
import { TapItemView, shuffleChoices } from './TapItemView';
import { applePictures, fishCount } from './testing';
import { CORRECT_TEXT, MISS_TEXT } from './theme';

let now = 0;
beforeEach(() => {
  now = 1_000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
});
afterEach(() => jest.restoreAllMocks());

describe('shuffleChoices', () => {
  const choices = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];

  it('keeps every choice and is stable for a seed', () => {
    const order = shuffleChoices(choices, 'seed-1');
    expect(order.map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(shuffleChoices(choices, 'seed-1')).toEqual(order);
  });

  it('gives different orders for different seeds', () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) =>
        shuffleChoices(choices, `seed-${i}`)
          .map((c) => c.id)
          .join(''),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe('TapItemView', () => {
  it('narrates the question and reports a right answer by choice id', async () => {
    const narrate = jest.fn();
    const onAnswer = jest.fn();
    await render(
      <TapItemView item={fishCount} narrate={narrate} onAnswer={onAnswer} shuffleSeed="x" />,
    );
    expect(narrate).toHaveBeenCalledWith([fishCount.narration]);
    expect(screen.getByLabelText('7 🐟')).toBeTruthy();

    now = 3_500;
    await fireEvent.press(screen.getByLabelText('7'));

    expect(onAnswer).toHaveBeenCalledWith({
      itemId: fishCount.id,
      answer: 'a',
      correct: true,
      msToAnswer: 2_500,
      replays: 0,
    });
    expect(narrate).toHaveBeenLastCalledWith(['7', CORRECT_TEXT]);
    expect(screen.getByText(CORRECT_TEXT)).toBeTruthy();
  });

  it('shows and says the why on a miss, and ignores later taps', async () => {
    const narrate = jest.fn();
    const onAnswer = jest.fn();
    await render(<TapItemView item={fishCount} narrate={narrate} onAnswer={onAnswer} />);

    await fireEvent.press(screen.getByLabelText('8'));
    await fireEvent.press(screen.getByLabelText('7'));

    expect(onAnswer).toHaveBeenCalledTimes(1);
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 'b', correct: false }));
    expect(narrate).toHaveBeenLastCalledWith(['8', MISS_TEXT, fishCount.why]);
    expect(screen.getByText(fishCount.why)).toBeTruthy();
  });

  it('counts replays before the answer only', async () => {
    const narrate = jest.fn();
    const onAnswer = jest.fn();
    await render(<TapItemView item={fishCount} narrate={narrate} onAnswer={onAnswer} />);

    await fireEvent.press(screen.getByLabelText('Say it again'));
    await fireEvent.press(screen.getByLabelText('Say it again'));
    expect(narrate).toHaveBeenLastCalledWith([fishCount.narration], { replay: true });
    await fireEvent.press(screen.getByLabelText('6'));
    await fireEvent.press(screen.getByLabelText('Say it again'));

    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ replays: 2 }));
    // After the answer, replay repeats the feedback.
    expect(narrate).toHaveBeenLastCalledWith(['6', MISS_TEXT, fishCount.why], { replay: true });
  });

  it('draws picture choices and speaks their labels', async () => {
    const narrate = jest.fn();
    const onAnswer = jest.fn();
    await render(<TapItemView item={applePictures} narrate={narrate} onAnswer={onAnswer} />);

    // The narration doesn't name the pictures, so their labels follow it.
    const [question] = narrate.mock.calls[0];
    expect(question[0]).toBe(applePictures.narration);
    expect(question.slice(1).sort()).toEqual(['Five apples', 'Six apples']);
    expect(screen.getByLabelText('5 🍎')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Six apples'));

    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 'b', correct: true }));
    expect(narrate).toHaveBeenLastCalledWith(['Six apples', CORRECT_TEXT]);
  });

  it('flags the item and moves on when asked', async () => {
    const onFlag = jest.fn();
    const onNext = jest.fn();
    await render(<TapItemView item={fishCount} onFlag={onFlag} onNext={onNext} />);

    await fireEvent.press(screen.getByLabelText('This looks wrong'));
    expect(onFlag).toHaveBeenCalledWith({
      contentKind: 'item',
      contentId: fishCount.id,
      cardIndex: null,
    });

    expect(screen.queryByLabelText('Next')).toBeNull();
    await fireEvent.press(screen.getByLabelText('7'));
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(onNext).toHaveBeenCalledTimes(1);
  });
});
