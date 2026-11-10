import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated } from 'react-native';
import type { CheckEnd } from '../session';
import { CheckEndView, DUR_STAR_MS } from './CheckEndView';

const mockNarrated: string[] = [];
jest.mock('../narration', () => ({
  useAutoNarration: (text: string) => mockNarrated.push(text),
  SpeakerButton: () => null,
}));

const passed: CheckEnd = {
  check: 'check',
  passed: true,
  skillId: 'k-count-to-20',
  skillTitle: 'Count to 20',
  storyAgain: false,
};

const timing = jest.spyOn(Animated, 'timing');
const reduceMotion = jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled');
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

async function setup(end: CheckEnd) {
  const onTrail = jest.fn();
  const onNext = jest.fn();
  await render(<CheckEndView end={end} onTrail={onTrail} onNext={onNext} />);
  return { onTrail, onNext };
}

beforeEach(() => {
  mockNarrated.length = 0;
  timing.mockClear();
  reduceMotion.mockResolvedValue(false);
});

describe('CheckEndView', () => {
  it('lands a star over dur-star on a passed check, then goes to the trail', async () => {
    const { onTrail } = await setup(passed);
    await settle();
    expect(screen.getByText('You did it!')).toBeTruthy();
    expect(screen.getByText('Count to 20 is done. Your star is on the trail.')).toBeTruthy();
    expect(mockNarrated).toContain('You did it! Count to 20 is done. Your star is on the trail.');
    expect(timing).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 1, duration: DUR_STAR_MS }),
    );

    await fireEvent.press(screen.getByLabelText('See my trail'));
    expect(onTrail).toHaveBeenCalledTimes(1);
  });

  it('skips the landing under reduced motion', async () => {
    reduceMotion.mockResolvedValue(true);
    await setup(passed);
    await settle();
    expect(timing).not.toHaveBeenCalled();
    expect(screen.getByLabelText('A star on your trail')).toBeTruthy();
  });

  it('shows a passed review', async () => {
    await setup({ ...passed, check: 'review' });
    expect(screen.getByText('Still got it!')).toBeTruthy();
    expect(screen.getByText('Count to 20 stays bright on your trail.')).toBeTruthy();
  });

  it('offers Later and Story again after a miss', async () => {
    const { onTrail, onNext } = await setup({ ...passed, passed: false, storyAgain: true });
    expect(screen.getByText('Almost there!')).toBeTruthy();
    expect(screen.queryByLabelText('A star on your trail')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Story again'));
    expect(onNext).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByLabelText('Later'));
    expect(onTrail).toHaveBeenCalledTimes(1);
  });

  it('keeps going without promising the story once walk-back starts', async () => {
    await setup({ ...passed, passed: false, storyAgain: false });
    expect(screen.queryByLabelText('Story again')).toBeNull();
    expect(screen.getByLabelText('Keep going')).toBeTruthy();
    expect(screen.queryByText(/story/)).toBeNull();
  });
});
