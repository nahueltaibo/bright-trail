import { render, screen } from '@testing-library/react-native';
import { loadBundle } from '../content/loadBundle';
import { QuitContext } from './quit';
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

  it('shows question dots in place of the break button, which moves beside the flag', async () => {
    await render(
      <QuitContext.Provider value={() => {}}>
        <ItemView item={fishCount} progress={{ current: 1, total: 5 }} />
      </QuitContext.Provider>,
    );
    expect(screen.getByLabelText('Question 2 of 5')).toBeTruthy();
    expect(screen.getByLabelText('Stop for now')).toBeTruthy();

    await render(<ItemView item={fishCount} />);
    expect(screen.queryByLabelText(/^Question/)).toBeNull();
  });

  it('shows question dots on a minigame', async () => {
    const { items } = await loadBundle();
    const shared = items.find((i) => i.scene)!;
    await render(<ItemView item={shared} progress={{ current: 0, total: 3 }} />);
    expect(screen.getByLabelText('Question 1 of 3')).toBeTruthy();
  });
});
