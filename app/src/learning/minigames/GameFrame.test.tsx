import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ItemView } from '../ItemView';
import { JOIN_DEMO_ITEMS } from '../join/demo';

describe('GameFrame choices', () => {
  it('keeps number choices at full tap height with their labels', async () => {
    const count = JOIN_DEMO_ITEMS.find((i) => i.id === 'demo-join-count')!;
    await render(<ItemView item={count} shuffleSeed="test" />);
    for (const n of ['4', '5', '6']) {
      const button = screen.getByRole('button', { name: n });
      const style = StyleSheet.flatten(button.props.style);
      // On a phone, a flex share inside the drag wrapper collapses the button to its border.
      expect(style.flex).toBeUndefined();
      expect(style.height).toBeGreaterThanOrEqual(64);
      expect(screen.getByText(n)).toBeTruthy();
    }
  });
});
