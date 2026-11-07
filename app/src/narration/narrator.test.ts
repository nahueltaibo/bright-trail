import * as Speech from 'expo-speech';
import { createNarrator, KID_RATE } from './narrator';

jest.mock('expo-speech', () => ({
  speak: jest.fn(),
  stop: jest.fn(async () => {}),
  getAvailableVoicesAsync: jest.fn(async () => []),
}));

const speak = jest.mocked(Speech.speak);
const getVoices = jest.mocked(Speech.getAvailableVoicesAsync);

const spoken = () => speak.mock.calls.map(([text]) => text);
/** Ends the utterance playing now, as the engine's onDone would. */
const finishCurrent = async () => {
  speak.mock.calls.at(-1)?.[1]?.onDone?.();
  await flush();
};
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
  getVoices.mockResolvedValue([]);
});

describe('createNarrator', () => {
  it('speaks a sequence one utterance at a time, in order', async () => {
    const narrator = createNarrator();
    narrator.speak(['How many apples?', 'Two', 'Three']);
    await flush();
    expect(spoken()).toEqual(['How many apples?']);
    expect(narrator.isSpeaking()).toBe(true);

    await finishCurrent();
    await finishCurrent();
    expect(spoken()).toEqual(['How many apples?', 'Two', 'Three']);
    expect(narrator.isSpeaking()).toBe(true);

    await finishCurrent();
    expect(narrator.isSpeaking()).toBe(false);
  });

  it('uses an en-CA voice when the device has one, at the kid rate', async () => {
    getVoices.mockResolvedValue([
      { identifier: 'us', name: 'US', language: 'en-US' },
      { identifier: 'ca', name: 'CA', language: 'en_CA' },
    ] as Speech.Voice[]);
    createNarrator().speak('Hi');
    await flush();
    expect(speak.mock.calls[0][1]).toMatchObject({
      language: 'en-CA',
      voice: 'ca',
      rate: KID_RATE,
    });
  });

  it('falls back to another English voice, then to the en-CA hint alone', async () => {
    getVoices.mockResolvedValue([
      { identifier: 'gb', name: 'GB', language: 'en-GB' },
    ] as Speech.Voice[]);
    createNarrator().speak('Hi');
    await flush();
    expect(speak.mock.calls[0][1]).toMatchObject({ language: 'en-GB', voice: 'gb' });

    speak.mockClear();
    getVoices.mockRejectedValue(new Error('no engine'));
    createNarrator().speak('Hi');
    await flush();
    expect(speak.mock.calls[0][1]).toMatchObject({ language: 'en-CA' });
    expect(speak.mock.calls[0][1]?.voice).toBeUndefined();
  });

  it('stop cancels the rest of the queue and ignores the interrupted callback', async () => {
    const narrator = createNarrator();
    narrator.speak(['one', 'two']);
    await flush();
    const interrupted = speak.mock.calls[0][1];

    narrator.stop();
    expect(Speech.stop).toHaveBeenCalled();
    expect(narrator.isSpeaking()).toBe(false);

    interrupted?.onDone?.();
    await flush();
    expect(spoken()).toEqual(['one']);
  });

  it('a new speak interrupts the old sequence', async () => {
    const narrator = createNarrator();
    narrator.speak(['old question', 'old choice']);
    await flush();
    narrator.speak('new question');
    await flush();
    speak.mock.calls[0][1]?.onDone?.();
    await flush();
    expect(spoken()).toEqual(['old question', 'new question']);
  });

  it('replay says the whole last sequence again', async () => {
    const narrator = createNarrator();
    narrator.replay();
    await flush();
    expect(speak).not.toHaveBeenCalled();

    narrator.speak(['question', 'choice']);
    await flush();
    await finishCurrent();
    await finishCurrent();
    narrator.replay();
    await flush();
    await finishCurrent();
    expect(spoken()).toEqual(['question', 'choice', 'question', 'choice']);
  });

  it('stop with an owner only stops speech that owner started', async () => {
    const narrator = createNarrator();
    narrator.speak('from the new screen', 'new');
    await flush();
    narrator.stop('old');
    expect(narrator.isSpeaking()).toBe(true);
    narrator.stop('new');
    expect(narrator.isSpeaking()).toBe(false);
  });

  it('notifies subscribers when speaking starts and ends', async () => {
    const narrator = createNarrator();
    const listener = jest.fn();
    narrator.subscribe(listener);
    narrator.speak('hi');
    expect(listener).toHaveBeenCalledTimes(1);
    await flush();
    await finishCurrent();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(narrator.isSpeaking()).toBe(false);
  });
});
