import { render, screen } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('shows the greeting from shared', async () => {
    await render(<HomeScreen learnerName="Mia" />);
    expect(screen.getByText('Hi Mia, welcome to BrightTrail!')).toBeTruthy();
  });
});
