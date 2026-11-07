import { toSpeech } from '@bright-trail/shared';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { useStorage } from '../storage/StorageProvider';
import { createNarrator, type Narrator } from './narrator';

const NarrationContext = createContext<Narrator | null>(null);

/** Owns the app's one narrator. Pass `narrator` only in tests. */
export function NarrationProvider({
  children,
  narrator: injected,
}: {
  children: ReactNode;
  narrator?: Narrator;
}) {
  const [narrator] = useState(() => injected ?? createNarrator());
  useEffect(() => () => narrator.stop(), [narrator]);
  return <NarrationContext.Provider value={narrator}>{children}</NarrationContext.Provider>;
}

export type Narration = {
  /** False until the child's reading mode is known. Auto-narration waits for it. */
  ready: boolean;
  /** True when reading mode is off, or there's no current child (kid home). */
  autoNarrate: boolean;
  isSpeaking: boolean;
  /** Auto-narration: speaks only when `autoNarrate` is true. Every text goes through `toSpeech`. */
  narrate(texts: string | readonly string[]): void;
  /** Explicit, for a tap: always speaks, even in reading mode. */
  speak(texts: string | readonly string[]): void;
  /** Says the last sequence again, even in reading mode. */
  replay(): void;
  stop(): void;
};

export type NarrationOptions = {
  /** Defaults to the `childId` route param, so screens under `/child/[childId]` need nothing. */
  childId?: string;
};

function useReadingMode(childId: string | undefined): boolean | undefined {
  const repo = useStorage();
  const [readingMode, setReadingMode] = useState<boolean | undefined>(childId ? undefined : false);

  // Re-read on focus so a reading-mode switch made on another screen applies on return.
  useFocusEffect(
    useCallback(() => {
      if (!childId) {
        setReadingMode(false);
        return;
      }
      let live = true;
      repo.children.get(childId).then(
        (child) => live && setReadingMode(child?.readingMode ?? false),
        () => live && setReadingMode(false),
      );
      return () => {
        live = false;
      };
    }, [repo, childId]),
  );
  return readingMode;
}

/** Narration for the current screen. Speech this hook starts stops when the screen loses focus. */
export function useNarration(options: NarrationOptions = {}): Narration {
  const narrator = useNarrator();
  const params = useLocalSearchParams<{ childId?: string }>();
  const childId = options.childId ?? params.childId;
  const readingMode = useReadingMode(childId);
  const owner = useId();

  const isSpeaking = useSyncExternalStore(narrator.subscribe, narrator.isSpeaking);

  useFocusEffect(useCallback(() => () => narrator.stop(owner), [narrator, owner]));

  const ready = readingMode !== undefined;
  const autoNarrate = readingMode === false;

  // Kept apart from `isSpeaking` so callers can list them as effect deps without restarting
  // speech each time it starts.
  const actions = useMemo(
    () => ({
      narrate: (texts: string | readonly string[]) => {
        if (autoNarrate) narrator.speak(spoken(texts), owner);
      },
      speak: (texts: string | readonly string[]) => narrator.speak(spoken(texts), owner),
      replay: () => narrator.replay(owner),
      stop: () => narrator.stop(),
    }),
    [narrator, owner, autoNarrate],
  );

  return { ready, autoNarrate, isSpeaking, ...actions };
}

/** Math formatting as words, e.g. "3/4" as "three fourths", so the device voice reads it right. */
const spoken = (texts: string | readonly string[]) =>
  (typeof texts === 'string' ? [texts] : texts).map(toSpeech);

function useNarrator(): Narrator {
  const narrator = useContext(NarrationContext);
  if (!narrator) throw new Error('useNarration must be used inside <NarrationProvider>');
  return narrator;
}

/**
 * Speaks `texts` each time the screen gains focus, unless reading mode is on. Pass null while
 * the text is still loading. Speaks again when the text changes.
 */
export function useAutoNarration(
  texts: string | readonly string[] | null,
  options: NarrationOptions = {},
): Narration {
  const narration = useNarration(options);
  const { ready, autoNarrate, speak } = narration;
  // A string key keeps an inline array literal from re-speaking on every render.
  const key = texts === null ? null : JSON.stringify(typeof texts === 'string' ? [texts] : texts);

  useFocusEffect(
    useCallback(() => {
      if (ready && autoNarrate && key) speak(JSON.parse(key) as string[]);
    }, [ready, autoNarrate, key, speak]),
  );
  return narration;
}
