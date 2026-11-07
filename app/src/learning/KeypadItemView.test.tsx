import type { KeypadItem } from '@bright-trail/shared';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { isKeypadCorrect, KeypadItemView, pressKey } from './KeypadItemView';
import { afterFourteen } from './testing';
import { MISS_TEXT } from './theme';

async function type(keys: string) {
  for (const key of keys) {
    await fireEvent.press(screen.getByLabelText(key === '.' ? 'Decimal point' : key));
  }
}

describe('pressKey', () => {
  it('appends digits, deletes, and drops a leading zero', () => {
    expect(pressKey('', '1')).toBe('1');
    expect(pressKey('1', '5')).toBe('15');
    expect(pressKey('15', '⌫')).toBe('1');
    expect(pressKey('', '⌫')).toBe('');
    expect(pressKey('0', '7')).toBe('7');
  });

  it('allows one decimal point and caps the length', () => {
    expect(pressKey('', '.')).toBe('0.');
    expect(pressKey('0.5', '.')).toBe('0.5');
    expect(pressKey('123456', '7')).toBe('123456');
  });
});

describe('isKeypadCorrect', () => {
  it('compares numbers, not strings', () => {
    expect(isKeypadCorrect('15', 15)).toBe(true);
    expect(isKeypadCorrect('0.3', 0.1 + 0.2)).toBe(true);
    expect(isKeypadCorrect('14', 15)).toBe(false);
    expect(isKeypadCorrect('', 0)).toBe(false);
  });
});

describe('KeypadItemView', () => {
  it('submits the typed number', async () => {
    const onAnswer = jest.fn();
    const narrate = jest.fn();
    await render(<KeypadItemView item={afterFourteen} onAnswer={onAnswer} narrate={narrate} />);
    expect(narrate).toHaveBeenCalledWith([afterFourteen.narration]);
    expect(screen.getByLabelText('Check my answer')).toBeDisabled();

    await type('19');
    await fireEvent.press(screen.getByLabelText('Delete'));
    await type('5');
    expect(screen.getByLabelText('Your answer, 15')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Check my answer'));

    expect(onAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ itemId: afterFourteen.id, answer: 15, correct: true }),
    );
    // Keys go away once answered.
    expect(screen.queryByLabelText('5')).toBeNull();
  });

  it('shows the right number and the why on a miss', async () => {
    const onAnswer = jest.fn();
    const narrate = jest.fn();
    await render(<KeypadItemView item={afterFourteen} onAnswer={onAnswer} narrate={narrate} />);
    await type('16');
    await fireEvent.press(screen.getByLabelText('Check my answer'));

    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 16, correct: false }));
    expect(screen.getByLabelText('The answer is 15')).toBeTruthy();
    expect(screen.getByText(afterFourteen.why)).toBeTruthy();
    expect(narrate).toHaveBeenLastCalledWith([MISS_TEXT, afterFourteen.why]);
  });

  it('only offers a decimal point when the answer has one', async () => {
    await render(<KeypadItemView item={afterFourteen} />);
    expect(screen.queryByLabelText('Decimal point')).toBeNull();
  });

  it('accepts a decimal answer', async () => {
    const half: KeypadItem = { ...afterFourteen, id: 'half', answer: 0.5 };
    const onAnswer = jest.fn();
    await render(<KeypadItemView item={half} onAnswer={onAnswer} />);
    await type('.5');
    await fireEvent.press(screen.getByLabelText('Check my answer'));
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ answer: 0.5, correct: true }));
  });
});
