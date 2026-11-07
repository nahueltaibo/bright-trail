import { render, screen } from '@testing-library/react-native';
import { ItemView } from './ItemView';
import { afterFourteen, findTwelve, fishCount } from './testing';

describe('ItemView', () => {
  it('renders the screen for each item type', async () => {
    await render(<ItemView item={fishCount} />);
    expect(screen.getByLabelText('8')).toBeTruthy();

    await render(<ItemView item={afterFourteen} />);
    expect(screen.getByLabelText('Delete')).toBeTruthy();

    await render(<ItemView item={findTwelve} />);
    expect(screen.getByTestId('number-line-track')).toBeTruthy();
  });
});
