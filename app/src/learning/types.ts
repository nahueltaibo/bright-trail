import type { Item } from '@bright-trail/shared';

/**
 * Speaks the texts in order. `replay` marks a tap on the speaker, which speaks even in reading
 * mode.
 */
export type Narrate = (texts: string[], options?: { replay?: boolean }) => void;

/** One answered item, as the session logs it. */
export type AnswerResult = {
  itemId: string;
  /** Choice id for tap items, the number entered or placed for the others. */
  answer: string | number;
  correct: boolean;
  msToAnswer: number;
  /** Replay taps before the answer. */
  replays: number;
};

/** What a "This looks wrong" tap points at. Matches the stored content flag. */
export type FlagTarget =
  | { contentKind: 'card'; contentId: string; cardIndex: number }
  | { contentKind: 'item'; contentId: string; cardIndex: null };

export type ItemViewProps<T extends Item = Item> = {
  item: T;
  narrate?: Narrate;
  onAnswer?: (result: AnswerResult) => void;
  onFlag?: (target: FlagTarget) => void;
  /** The child tapped "next" after the feedback. */
  onNext?: () => void;
  /**
   * The answer measures what the child knows: placement, probes, and reviews. Games then show why
   * and move on instead of offering another try.
   */
  measuring?: boolean;
};
