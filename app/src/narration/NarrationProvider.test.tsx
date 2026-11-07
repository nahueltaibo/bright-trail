import type { ChildProfile } from '@bright-trail/shared';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Speech from 'expo-speech';
import { Text } from 'react-native';
import { NarrationProvider, useAutoNarration } from './NarrationProvider';
import { SpeakerButton } from './SpeakerButton';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

// Screens render outside a navigator here, so focus is mount and blur is unmount.
let mockRouteParams: { childId?: string } = {};
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockRouteParams,
  useFocusEffect: (effect: () => void | (() => void)) => {
    jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]);
  },
}));

const mockChildren: Record<string, ChildProfile> = {
  reader: {
    id: 'reader',
    firstName: 'Leo',
    birthdate: '2016-07-02',
    avatar: 'owl',
    readingMode: true,
  },
  listener: {
    id: 'listener',
    firstName: 'Maya',
    birthdate: '2020-03-14',
    avatar: 'fox',
    readingMode: false,
  },
};
jest.mock('../storage/StorageProvider', () => ({
  useStorage: () => ({ children: { get: async (id: string) => mockChildren[id] ?? null } }),
}));

const speak = jest.mocked(Speech.speak);
const spoken = () => speak.mock.calls.map(([text]) => text);
const settle = () => act(() => new Promise((r) => setTimeout(r, 0)));

function Screen({ texts }: { texts: string[] | null }) {
  const { isSpeaking } = useAutoNarration(texts);
  return (
    <>
      <Text>{isSpeaking ? 'speaking' : 'quiet'}</Text>
      <SpeakerButton text={texts ?? undefined} />
    </>
  );
}

const renderScreen = (texts: string[] | null = ['Question?', 'Choice A']) =>
  render(
    <NarrationProvider>
      <Screen texts={texts} />
    </NarrationProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockRouteParams = {};
});

describe('useAutoNarration', () => {
  it('narrates on its own when the child has reading mode off', async () => {
    mockRouteParams = { childId: 'listener' };
    await renderScreen();
    await settle();
    expect(spoken()).toEqual(['Question?']);
    expect(screen.getByText('speaking')).toBeTruthy();
  });

  it('stays quiet when the child has reading mode on', async () => {
    mockRouteParams = { childId: 'reader' };
    await renderScreen();
    await settle();
    expect(speak).not.toHaveBeenCalled();
  });

  it('narrates when there is no current child, as on kid home', async () => {
    await renderScreen(['Ask a grown-up to add you.']);
    await settle();
    expect(spoken()).toEqual(['Ask a grown-up to add you.']);
  });

  it('waits for text that is still loading', async () => {
    await renderScreen(null);
    await settle();
    expect(speak).not.toHaveBeenCalled();
  });

  it('stops speech when the screen goes away', async () => {
    const { unmount } = await renderScreen();
    await settle();
    await act(() => unmount());
    expect(Speech.stop).toHaveBeenCalled();
  });

  it('does not restart when isSpeaking changes', async () => {
    function Probe() {
      // Re-renders when speech starts, which must not re-trigger auto-narration.
      useAutoNarration('Once');
      return null;
    }
    await render(
      <NarrationProvider>
        <Probe />
      </NarrationProvider>,
    );
    await settle();
    await settle();
    expect(spoken()).toEqual(['Once']);
  });
});

describe('useNarration', () => {
  it('reads math formatting as words', async () => {
    await render(
      <NarrationProvider>
        <SpeakerButton text="What is 3/4 of 24 336?" />
      </NarrationProvider>,
    );
    await fireEvent.press(screen.getByLabelText('Hear it again'));
    await settle();
    expect(spoken()).toEqual([
      'What is three fourths of twenty-four thousand three hundred thirty-six?',
    ]);
  });
});

describe('SpeakerButton', () => {
  it('speaks on tap even in reading mode', async () => {
    mockRouteParams = { childId: 'reader' };
    const onPress = jest.fn();
    await render(
      <NarrationProvider>
        <SpeakerButton text={['Question?', 'Choice A']} onPress={onPress} />
      </NarrationProvider>,
    );
    await settle();
    await fireEvent.press(screen.getByLabelText('Hear it again'));
    await settle();
    expect(spoken()).toEqual(['Question?']);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('without text, replays the last sequence', async () => {
    await render(
      <NarrationProvider>
        <Screen texts={['Question?', 'Choice A']} />
        <SpeakerButton accessibilityLabel="Replay" />
      </NarrationProvider>,
    );
    await settle();
    await act(async () => speak.mock.calls[0][1]?.onDone?.());
    await settle();
    await fireEvent.press(screen.getByLabelText('Replay'));
    await settle();
    expect(spoken()).toEqual(['Question?', 'Choice A', 'Question?']);
  });
});
