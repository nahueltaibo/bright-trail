import { render, screen } from '@testing-library/react-native';
import { gridOf } from './FractionPicture';
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

  it.each(['circle', 'rectangle', 'bar'] as const)(
    'cuts a %s into equal parts and shades some',
    async (shape) => {
      await render(
        <VisualView
          visual={{ kind: 'fraction', shape, parts: 4, shaded: 3 }}
          width={300}
          height={300}
        />,
      );
      expect(screen.getByLabelText(`a ${shape} cut into 4 equal parts, 3 shaded`)).toBeTruthy();
      expect(screen.getAllByTestId('fraction-part-shaded')).toHaveLength(3);
      expect(screen.getAllByTestId('fraction-part')).toHaveLength(1);
    },
  );

  it('fills one whole before the next', async () => {
    await render(
      <VisualView
        visual={{ kind: 'fraction', shape: 'circle', parts: 4, shaded: 7, wholes: 2 }}
        width={300}
        height={200}
      />,
    );
    expect(screen.getAllByTestId('fraction-part-shaded')).toHaveLength(7);
    expect(screen.getAllByTestId('fraction-part')).toHaveLength(1);
  });

  it('shows the label under the picture', async () => {
    await render(
      <VisualView
        visual={{ kind: 'fraction', shape: 'bar', parts: 3, shaded: 0, label: '0/3' }}
        width={300}
        height={200}
      />,
    );
    expect(screen.getByText('0/3')).toBeTruthy();
    expect(screen.queryAllByTestId('fraction-part-shaded')).toHaveLength(0);
  });
});

describe('gridOf', () => {
  it.each([
    [4, 2, 2],
    [6, 2, 3],
    [9, 3, 3],
    [12, 3, 4],
    [7, 1, 7],
  ])('lays %i parts out in %i rows of %i', (parts, rows, cols) => {
    expect(gridOf(parts)).toEqual({ rows, cols });
  });
});
