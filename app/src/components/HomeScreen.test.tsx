import { parseContentBundle } from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { render, screen } from '@testing-library/react-native';
import { HomeScreen } from './HomeScreen';

describe('HomeScreen', () => {
  it('lists the skills from the shared sample bundle', async () => {
    await render(<HomeScreen skills={parseContentBundle(sample).skills} />);
    expect(screen.getByText('Count to 20')).toBeTruthy();
    expect(screen.getByText('Adding to 10')).toBeTruthy();
  });
});
