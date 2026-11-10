import { parseContentBundle } from '@bright-trail/shared';
import sample from '@bright-trail/shared/fixtures/sample-bundle.json';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { groupSkillsByGrade, layoutSkillGraph } from '../skillTree';
import { SkillGraph } from './SkillGraph';

const { skills } = parseContentBundle(sample);
const layout = layoutSkillGraph(groupSkillsByGrade(skills, [], '2026-11-06'));

describe('SkillGraph', () => {
  it('names each skill with its state and reports a tap', async () => {
    const onSelect = jest.fn();
    await render(<SkillGraph layout={layout} onSelect={onSelect} />);

    expect(screen.getByText('Kindergarten')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText(`${skills[1]!.title}, Unknown`));
    expect(onSelect).toHaveBeenCalledWith(skills[1]!.id);
  });
});
