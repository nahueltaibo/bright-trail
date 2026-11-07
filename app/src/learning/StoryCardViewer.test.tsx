import { fireEvent, render, screen } from '@testing-library/react-native';
import { StoryCardViewer } from './StoryCardViewer';
import { bundle } from './testing';

const nugget = bundle.nuggets[0];

describe('StoryCardViewer', () => {
  it('narrates each card as it appears and shows progress', async () => {
    const narrate = jest.fn();
    await render(<StoryCardViewer nugget={nugget} narrate={narrate} />);

    expect(narrate).toHaveBeenLastCalledWith([nugget.cards[0].narration]);
    expect(screen.getByLabelText(`Card 1 of ${nugget.cards.length}`)).toBeTruthy();
    expect(screen.getByLabelText('Back')).toBeDisabled();

    await fireEvent.press(screen.getByLabelText('Next'));
    expect(narrate).toHaveBeenLastCalledWith([nugget.cards[1].narration]);
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByLabelText('5 🐟')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Back'));
    expect(screen.getByLabelText(`Card 1 of ${nugget.cards.length}`)).toBeTruthy();
    expect(narrate).toHaveBeenCalledTimes(3);
  });

  it('replays the current card', async () => {
    const narrate = jest.fn();
    await render(<StoryCardViewer nugget={nugget} narrate={narrate} />);
    await fireEvent.press(screen.getByLabelText('Say it again'));
    expect(narrate).toHaveBeenCalledTimes(2);
    expect(narrate).toHaveBeenLastCalledWith([nugget.cards[0].narration]);
  });

  it('turns "next" into "done" on the last card', async () => {
    const onDone = jest.fn();
    await render(<StoryCardViewer nugget={nugget} onDone={onDone} />);
    for (let i = 1; i < nugget.cards.length; i++) {
      await fireEvent.press(screen.getByLabelText('Next'));
    }
    expect(screen.queryByLabelText('Next')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Done'));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('flags the card on screen once, with its index', async () => {
    const onFlag = jest.fn();
    await render(<StoryCardViewer nugget={nugget} onFlag={onFlag} />);
    await fireEvent.press(screen.getByLabelText('Next'));
    await fireEvent.press(screen.getByLabelText('This looks wrong'));

    expect(onFlag).toHaveBeenCalledWith({
      contentKind: 'card',
      contentId: nugget.id,
      cardIndex: 1,
    });
    expect(screen.getByLabelText('Thanks for telling us')).toBeDisabled();

    // The next card can be flagged on its own.
    await fireEvent.press(screen.getByLabelText('Next'));
    expect(screen.getByLabelText('This looks wrong')).toBeTruthy();
  });
});
