import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ChildDraft } from '../children';
import { ChildForm } from './ChildForm';
import { stepDate } from './DateField';

const TODAY = '2026-11-06';

const maya: ChildDraft = {
  firstName: 'Maya',
  birthdate: '2020-03-14',
  avatar: 'fox',
  gradeOverride: null,
  readingMode: false,
  dyslexicFont: false,
  subjects: ['math'],
};

describe('ChildForm', () => {
  it('adds a child with a name, avatar, birthdate, and grade override', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(
      <ChildForm
        initial={{ ...maya, firstName: '' }}
        today={TODAY}
        submitLabel="Add child"
        onSubmit={onSubmit}
      />,
    );

    await fireEvent.changeText(screen.getByLabelText('First name'), 'Maya');
    await fireEvent.press(screen.getByLabelText('Owl'));
    await fireEvent.press(screen.getByLabelText('Next year'));
    expect(screen.getByText('Auto (SK)')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Grade 1'));
    await fireEvent.press(screen.getByText('Add child'));

    expect(onSubmit).toHaveBeenCalledWith({
      ...maya,
      avatar: 'owl',
      birthdate: '2021-03-14',
      gradeOverride: '1',
    });
  });

  it('shows the derived grade and the saved override when editing', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(
      <ChildForm
        initial={{ ...maya, gradeOverride: '2' }}
        today={TODAY}
        submitLabel="Save"
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByDisplayValue('Maya')).toBeTruthy();
    expect(screen.getByText(/From the birthdate: Grade 1/)).toBeTruthy();
    expect(screen.getByLabelText('Grade 2').props.accessibilityState).toMatchObject({
      selected: true,
    });

    await fireEvent.press(screen.getByLabelText('Auto (Grade 1)'));
    await fireEvent.press(screen.getByText('Save'));
    expect(onSubmit).toHaveBeenCalledWith(maya);
  });

  it('turns on reading mode and the dyslexia-friendly font', async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    await render(<ChildForm initial={maya} today={TODAY} submitLabel="Save" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByLabelText('Reading mode'));
    await fireEvent.press(screen.getByLabelText('Dyslexia-friendly font'));
    expect(screen.getByLabelText('Dyslexia-friendly font').props.accessibilityState).toMatchObject({
      checked: true,
    });
    await fireEvent.press(screen.getByText('Save'));

    expect(onSubmit).toHaveBeenCalledWith({ ...maya, readingMode: true, dyslexicFont: true });
  });

  it('will not save without a name', async () => {
    const onSubmit = jest.fn();
    await render(
      <ChildForm
        initial={{ ...maya, firstName: '  ' }}
        today={TODAY}
        submitLabel="Add child"
        onSubmit={onSubmit}
      />,
    );
    await fireEvent.press(screen.getByText('Add child'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('will not save without a subject', async () => {
    const onSubmit = jest.fn();
    await render(<ChildForm initial={maya} today={TODAY} submitLabel="Save" onSubmit={onSubmit} />);

    await fireEvent.press(screen.getByLabelText('Math'));
    expect(screen.getByText('Pick at least one subject.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Save'));
    expect(onSubmit).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByLabelText('Math'));
    await fireEvent.press(screen.getByText('Save'));
    expect(onSubmit).toHaveBeenCalledWith(maya);
  });

  it('shows the error when saving fails', async () => {
    await render(
      <ChildForm
        initial={maya}
        today={TODAY}
        submitLabel="Save"
        onSubmit={() => Promise.reject(new Error('Disk full'))}
      />,
    );
    await fireEvent.press(screen.getByText('Save'));
    expect(screen.getByText('Disk full')).toBeTruthy();
  });
});

describe('stepDate', () => {
  it('wraps months and days and clamps years', () => {
    expect(stepDate('2020-12-14', 'month', 1, 2010, 2026)).toBe('2020-01-14');
    expect(stepDate('2020-03-01', 'day', -1, 2010, 2026)).toBe('2020-03-31');
    expect(stepDate('2026-03-01', 'year', 1, 2010, 2026)).toBe('2026-03-01');
  });

  it('keeps the day inside the new month', () => {
    expect(stepDate('2020-01-31', 'month', 1, 2010, 2026)).toBe('2020-02-29');
    expect(stepDate('2020-02-29', 'year', 1, 2010, 2026)).toBe('2021-02-28');
  });
});
