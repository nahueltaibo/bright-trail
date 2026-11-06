import * as Speech from 'expo-speech';

/** Speech rate for young listeners. 1.0 is the device default. */
export const KID_RATE = 0.9;
export const PREFERRED_LANGUAGE = 'en-CA';

/** The slice of `expo-speech` the narrator uses, so tests can pass a fake. */
export type SpeechEngine = Pick<typeof Speech, 'speak' | 'stop' | 'getAvailableVoicesAsync'>;

export type Narrator = {
  /** Stops anything playing, then says each text in order. `owner` tags who started it. */
  speak(texts: string | readonly string[], owner?: string): void;
  /** Says the last sequence again from the start. No-op if nothing was said yet. */
  replay(owner?: string): void;
  /** With `owner`, stops only if that owner started what is playing. */
  stop(owner?: string): void;
  isSpeaking(): boolean;
  /** Calls `listener` whenever `isSpeaking()` may have changed. Returns an unsubscribe. */
  subscribe(listener: () => void): () => void;
};

const normalize = (lang: string) => lang.replace('_', '-').toLowerCase();

/** en-CA if the device has it, else any English voice, else the device default. */
async function pickVoice(engine: SpeechEngine): Promise<{ language?: string; voice?: string }> {
  try {
    const voices = await engine.getAvailableVoicesAsync();
    const want = normalize(PREFERRED_LANGUAGE);
    const exact = voices.find((v) => normalize(v.language) === want);
    if (exact) return { language: PREFERRED_LANGUAGE, voice: exact.identifier };
    const english = voices.find((v) => normalize(v.language).startsWith('en'));
    if (english) return { language: english.language, voice: english.identifier };
  } catch {
    // Some Android engines list no voices until warmed up. The language hint still applies.
  }
  return { language: PREFERRED_LANGUAGE };
}

/**
 * Plays one utterance at a time and starts the next on `onDone`, instead of leaning on the
 * native queue, so `isSpeaking` and owner-scoped `stop` stay accurate.
 */
export function createNarrator(engine: SpeechEngine = Speech): Narrator {
  const listeners = new Set<() => void>();
  let voice: { language?: string; voice?: string } = { language: PREFERRED_LANGUAGE };
  const voiceReady = pickVoice(engine).then((v) => (voice = v));

  let last: readonly string[] = [];
  let queue: string[] = [];
  let currentOwner: string | undefined;
  let speaking = false;
  // Bumped on every speak/stop so callbacks from an interrupted utterance are ignored.
  let generation = 0;

  const setSpeaking = (value: boolean) => {
    if (speaking === value) return;
    speaking = value;
    listeners.forEach((l) => l());
  };

  const next = (gen: number) => {
    if (gen !== generation) return;
    const text = queue.shift();
    if (text === undefined) {
      currentOwner = undefined;
      setSpeaking(false);
      return;
    }
    const advance = () => next(gen);
    engine.speak(text, { ...voice, rate: KID_RATE, onDone: advance, onError: advance });
  };

  const halt = () => {
    generation++;
    queue = [];
    currentOwner = undefined;
    void engine.stop();
  };

  const narrator: Narrator = {
    speak(texts, owner) {
      const list = (typeof texts === 'string' ? [texts] : [...texts]).filter((t) => t.trim());
      halt();
      if (list.length === 0) {
        setSpeaking(false);
        return;
      }
      last = list;
      queue = [...list];
      currentOwner = owner;
      setSpeaking(true);
      const gen = generation;
      // Wait for voice selection only on the first utterance. Later calls resolve at once.
      voiceReady.then(() => next(gen));
    },
    replay(owner) {
      if (last.length > 0) narrator.speak(last, owner);
    },
    stop(owner) {
      if (owner !== undefined && owner !== currentOwner) return;
      if (!speaking && queue.length === 0) return;
      halt();
      setSpeaking(false);
    },
    isSpeaking: () => speaking,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return narrator;
}
