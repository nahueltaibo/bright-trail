import { fireEvent, render, screen } from '@testing-library/react-native';
import { ReportSheet } from './ReportSheet';

jest.mock('../narration', () => ({
  useAutoNarration: () => undefined,
  SpeakerButton: () => null,
}));

async function setup() {
  const onSend = jest.fn();
  const onClose = jest.fn();
  await render(<ReportSheet onSend={onSend} onClose={onClose} />);
  return { onSend, onClose };
}

describe('ReportSheet', () => {
  it('sends the comment typed in', async () => {
    const { onSend, onClose } = await setup();
    await fireEvent.changeText(screen.getByLabelText('What looks wrong'), 'The towers are wrong');
    await fireEvent.press(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenCalledWith('The towers are wrong');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends without a comment, once', async () => {
    const { onSend } = await setup();
    await fireEvent.press(screen.getByLabelText('Send'));
    await fireEvent.press(screen.getByLabelText('Send'));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith('');
  });

  it('closes without sending', async () => {
    const { onSend, onClose } = await setup();
    await fireEvent.press(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('caps the comment at the report limit', async () => {
    await setup();
    expect(screen.getByLabelText('What looks wrong').props.maxLength).toBe(500);
  });
});
