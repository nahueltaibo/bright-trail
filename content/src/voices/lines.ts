import { toSpeech, type ContentBundle, type Item } from '@bright-trail/shared';

export interface SampleLine {
  id: string;
  /** What the line tests, shown on the comparison page. */
  label: string;
  /** The text as written in the bundle. */
  written: string;
  /** The text the providers read: `written` through `toSpeech`. */
  spoken: string;
}

// The app's feedback titles in app/src/learning/theme.ts. The content package can't import the app.
const CORRECT_TEXT = 'Yes! Great job!';
const MISS_TEXT = 'Good try!';

type Pick = (bundle: ContentBundle) => string | undefined;

const itemNarration =
  (test: (item: Item) => boolean): Pick =>
  (bundle) =>
    bundle.items.find(test)?.narration;

const narrationMatches = (pattern: RegExp) => itemNarration((i) => pattern.test(i.narration));

const storyCards = (bundle: ContentBundle) =>
  bundle.nuggets.flatMap((n) => n.cards.map((c) => c.narration));

const PICKS: { id: string; label: string; pick: Pick }[] = [
  {
    id: 'story-pip',
    label: 'Pip story card',
    pick: (b) => storyCards(b).find((t) => /\bPip\b/.test(t)),
  },
  {
    id: 'story-long',
    label: 'Long story card',
    pick: (b) =>
      storyCards(b).reduce<string | undefined>(
        (a, t) => (a && a.length >= t.length ? a : t),
        undefined,
      ),
  },
  {
    id: 'counting',
    label: 'Counting run',
    pick: narrationMatches(/\b1, 2, 3\b.*what comes next/i),
  },
  { id: 'sum', label: 'Addition fact', pick: narrationMatches(/\d \+ \d = \d/) },
  { id: 'fraction', label: 'Fraction 3/4', pick: narrationMatches(/(^|\s)3\/4\b/) },
  { id: 'decimal', label: 'Decimal', pick: narrationMatches(/\b0\.\d\b/) },
  { id: 'percent', label: 'Percent', pick: narrationMatches(/\d%/) },
  {
    id: 'mixed-amounts',
    label: 'Percent, fraction and decimal together',
    pick: narrationMatches(/\d%.*\d\/\d.*\d\.\d|\d\.\d.*\d\/\d.*\d%/),
  },
  {
    id: 'number-line',
    label: 'Number line instruction',
    pick: narrationMatches(/^Move the frog to/),
  },
  { id: 'praise', label: 'Praise', pick: () => CORRECT_TEXT },
  {
    id: 'try-again',
    label: 'Miss, then why',
    pick: (b) => {
      const why = b.items.find((i) => /\b1, 2, 3\b/.test(i.narration))?.why;
      return why && `${MISS_TEXT} ${why}`;
    },
  },
  { id: 'food', label: 'Food name', pick: narrationMatches(/\b(brownies|granola)\b/i) },
];

/** The lines every provider reads. Throws when the bundle no longer has one of them. */
export function sampleLines(bundle: ContentBundle): SampleLine[] {
  return PICKS.map(({ id, label, pick }) => {
    const written = pick(bundle);
    if (!written) throw new Error(`No bundle line for ${id} (${label})`);
    return { id, label, written, spoken: toSpeech(written) };
  });
}
