import { render, screen } from '@testing-library/react-native';
import { VisualView } from './VisualView';

describe('VisualView', () => {
  it('draws a single emoji', async () => {
    await render(<VisualView visual={{ kind: 'emoji', emoji: '🐧' }} width={200} height={200} />);
    expect(screen.getByLabelText('🐧')).toBeTruthy();
    expect(screen.getByText('🐧')).toBeTruthy();
  });

  it('draws one emoji per object', async () => {
    await render(
      <VisualView visual={{ kind: 'objects', emoji: '🍎', count: 7 }} width={300} height={200} />,
    );
    expect(screen.getByLabelText('7 🍎')).toBeTruthy();
    expect(screen.getAllByText('🍎')).toHaveLength(7);
  });

  it('fills the ten-frame cells it is told to', async () => {
    await render(<VisualView visual={{ kind: 'ten-frame', filled: 3 }} width={300} height={200} />);
    expect(screen.getByLabelText('Ten frame with 3 filled')).toBeTruthy();
    expect(screen.getAllByTestId('ten-frame-dot')).toHaveLength(3);
  });

  it('draws an empty ten-frame', async () => {
    await render(<VisualView visual={{ kind: 'ten-frame', filled: 0 }} width={300} height={200} />);
    expect(screen.queryAllByTestId('ten-frame-dot')).toHaveLength(0);
  });
});
