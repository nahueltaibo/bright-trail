import { toSpeech, type SkillGrade } from '@bright-trail/shared';
import { riskyTokensIn } from '../graph/checks';
import { numberWord } from './numbers';

/**
 * Reading level by grade. Flesch-Kincaid and similar formulas are built from words per sentence
 * and syllables per word, but they swing wildly on one-line texts. So each input gets its own cap:
 * words per sentence and per text, and the share of long words across the whole skill.
 */
export interface ReadingLimits {
  sentenceWords: number;
  cardWords: number;
  questionWords: number;
  whyWords: number;
  /** Share of words with 3+ syllables, number words excluded, over all of a skill's text. */
  longWordShare: number;
}

export const READING_LIMITS: Record<'K' | '1' | '2' | '3-4' | '5-6', ReadingLimits> = {
  K: { sentenceWords: 10, cardWords: 22, questionWords: 25, whyWords: 22, longWordShare: 0.08 },
  '1': { sentenceWords: 12, cardWords: 26, questionWords: 28, whyWords: 25, longWordShare: 0.1 },
  '2': { sentenceWords: 14, cardWords: 30, questionWords: 32, whyWords: 30, longWordShare: 0.12 },
  '3-4': { sentenceWords: 18, cardWords: 40, questionWords: 40, whyWords: 35, longWordShare: 0.15 },
  '5-6': { sentenceWords: 22, cardWords: 50, questionWords: 50, whyWords: 45, longWordShare: 0.2 },
};

export function readingLimits(grade: SkillGrade): ReadingLimits {
  if (grade === 'K' || grade === '1' || grade === '2') return READING_LIMITS[grade];
  return grade === '3' || grade === '4' ? READING_LIMITS['3-4'] : READING_LIMITS['5-6'];
}

/** Words in a text. A spaced number such as `10 000` counts as one word. */
export function wordsOf(text: string): string[] {
  return text
    .replace(/(\d)[ \u00a0](?=\d{3}\b)/g, '$1')
    .split(/[\s—–]+/)
    .filter((w) => /[\p{L}\d]/u.test(w));
}

/** Sentences end at . ! ? or … followed by a space or the end, so "2.5" stays one sentence. */
export function sentencesOf(text: string): string[] {
  return text
    .split(/(?<=[.!?…])["')\]]*\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Vowel-group syllable estimate. Good enough to tell "cat" from "equivalent". */
export function syllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  return Math.max(1, w.match(/[aeiouy]{1,2}/g)?.length ?? 1);
}

const NUMBER_PARTS = /^(hundred|thousand|million|billion)s?$/;

export function isLongWord(word: string): boolean {
  const w = word.toLowerCase().replace(/[^a-z-]/g, '');
  if (!w || numberWord(w) !== null || NUMBER_PARTS.test(w)) return false;
  // Hyphenated number words like "twenty-one" and ordinals like "seventeenth" are numbers too.
  if (
    w
      .split('-')
      .every((part) => numberWord(part) !== null || numberWord(part.replace(/th$/, '')) !== null)
  )
    return false;
  return syllables(w) >= 3;
}

export type TextRole = 'card' | 'question' | 'why' | 'prompt' | 'choice';

/** Sentence and length caps for one kid-facing text. */
export function readingProblems(text: string, role: TextRole, grade: SkillGrade): string[] {
  const limits = readingLimits(grade);
  const problems: string[] = [];
  for (const sentence of sentencesOf(text)) {
    const n = wordsOf(sentence).length;
    if (n > limits.sentenceWords) {
      problems.push(
        `sentence has ${n} words, Grade ${grade} max is ${limits.sentenceWords}: "${sentence}"`,
      );
    }
  }
  const cap =
    role === 'card'
      ? limits.cardWords
      : role === 'question'
        ? limits.questionWords
        : role === 'why'
          ? limits.whyWords
          : null;
  const n = wordsOf(text).length;
  if (cap !== null && n > cap) problems.push(`${n} words, Grade ${grade} max is ${cap}`);
  return problems;
}

/** Share of long words across texts. */
export function longWordShare(texts: readonly string[]): { share: number; examples: string[] } {
  const words = texts.flatMap(wordsOf);
  const long = words.filter(isLongWord).map((w) => w.toLowerCase().replace(/[^a-z-]/g, ''));
  return {
    share: words.length ? long.length / words.length : 0,
    examples: [...new Set(long)].slice(0, 8),
  };
}

const LEFTOVER_SYMBOL = /[<>=≈×÷*^²³√(){}[\]#&@_|~\\/+$%¢]/;

/**
 * Problems `toSpeech()` would leave in spoken text: digits or symbols it can't turn into words,
 * and patterns it misreads, such as a dash between words becoming "minus".
 */
export function speechProblems(text: string): string[] {
  const problems: string[] = [];
  const spoken = toSpeech(text);
  const digits = /\S*\d\S*/.exec(spoken);
  if (digits) problems.push(`toSpeech leaves digits in "${digits[0]}"`);
  const symbol = LEFTOVER_SYMBOL.exec(spoken);
  if (symbol) problems.push(`toSpeech can't say "${symbol[0]}"`);
  if (/\d(st|nd|rd|th)\b/i.test(text)) problems.push('write ordinals in words, e.g. "third"');
  if (/\d[:,]\d/.test(text)) problems.push('no colons or commas inside numbers');
  if (/\d[-−–]\d/.test(text))
    problems.push('a dash between numbers reads badly, use "to" or " - " with spaces');
  if (/(^|[^\d\s)])\s[-–−]\s/.test(text)) problems.push('" - " after a word is read as "minus"');
  if (/\p{Extended_Pictographic}/u.test(text)) problems.push('no emoji in spoken text');
  return problems;
}

/** Words that ask for a spoken, drawn, or written answer, which no item type can take. */
export function riskyProblems(text: string): string[] {
  return riskyTokensIn(text).map(
    (token) => `uses "${token}", which asks for something the app can't take`,
  );
}
