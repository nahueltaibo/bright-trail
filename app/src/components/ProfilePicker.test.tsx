import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ChildProfile } from '@bright-trail/shared';
import { ProfilePicker } from './ProfilePicker';

const SAMPLE_CHILDREN: ChildProfile[] = [
  { id: 'maya', firstName: 'Maya', birthdate: '2020-03-14', avatar: 'fox', readingMode: false },
  { id: 'leo', firstName: 'Leo', birthdate: '2016-07-02', avatar: 'owl', readingMode: true },
];

describe('ProfilePicker', () => {
  it('shows one avatar button per child and reports the one tapped', async () => {
    const onPick = jest.fn();
    await render(<ProfilePicker profiles={SAMPLE_CHILDREN} onPick={onPick} />);

    expect(screen.getByText('🦊')).toBeTruthy();
    expect(screen.getByText('🦉')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Leo, Owl'));
    expect(onPick).toHaveBeenCalledWith(SAMPLE_CHILDREN[1]);
  });

  it('falls back to a known avatar for an unknown key', async () => {
    await render(
      <ProfilePicker profiles={[{ ...SAMPLE_CHILDREN[0], avatar: 'dragon' }]} onPick={jest.fn()} />,
    );
    expect(screen.getByLabelText('Maya, Fox')).toBeTruthy();
  });
});
