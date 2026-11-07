import { toSpeech } from '@bright-trail/shared';
import { describe, expect, it } from 'vitest';
import {
  isLongWord,
  longWordShare,
  readingProblems,
  riskyProblems,
  sentencesOf,
  speechProblems,
  syllables,
  wordsOf,
} from './text-checks';

describe('reading level', () => {
  it('splits sentences without breaking decimals', () => {
    expect(sentencesOf('Mia has 2.5 cups. Is that more? Yes!')).toEqual([
      'Mia has 2.5 cups.',
      'Is that more?',
      'Yes!',
    ]);
  });

  it('counts a spaced number as one word', () => {
    expect(wordsOf('There are 24 336 fans — wow.')).toEqual([
      'There',
      'are',
      '24336',
      'fans',
      'wow.',
    ]);
  });

  it('estimates syllables', () => {
    expect(syllables('cat')).toBe(1);
    expect(syllables('apple')).toBe(2);
    expect(syllables('equivalent')).toBe(4);
    expect(syllables('denominator')).toBe(5);
  });

  it('does not count number words as long', () => {
    expect(isLongWord('seventeen')).toBe(false);
    expect(isLongWord('seventy-seven')).toBe(false);
    expect(isLongWord('seventeenth')).toBe(false);
    expect(isLongWord('equivalent')).toBe(true);
  });

  it('caps sentence length by grade', () => {
    const long = 'The frog hops and hops and hops along the long green log today.';
    expect(readingProblems(long, 'card', 'K')[0]).toMatch(/13 words, Grade K max is 10/);
    expect(readingProblems(long, 'card', '5')).toEqual([]);
  });

  it('caps a text by role and grade', () => {
    const text = Array.from({ length: 6 }, () => 'Pip sees a red ball.').join(' ');
    expect(readingProblems(text, 'card', 'K')).toEqual(['30 words, Grade K max is 22']);
    expect(readingProblems(text, 'prompt', 'K')).toEqual([]);
  });

  it('measures the long-word share', () => {
    const { share, examples } = longWordShare(['Equivalent fractions are equal.', 'Cats nap.']);
    expect(share).toBeCloseTo(1 / 6);
    expect(examples).toEqual(['equivalent']);
  });
});

describe('speechProblems', () => {
  it('accepts every format toSpeech reads', () => {
    for (const text of [
      'What is 24 336 + 1?',
      'Is 3/4 more than 1/2?',
      'It is -6 degrees.',
      'Round 3.555… to 3.56.',
      'It costs $2.50, or 75¢ less.',
      'Count by 5s: 5, 10, 15.',
      'What is 6 × 5 ÷ 3 - 2 = ?',
      '25% of 80 is 20.',
    ]) {
      expect(speechProblems(text), text).toEqual([]);
      expect(toSpeech(text)).not.toMatch(/\d/);
    }
  });

  it('flags text toSpeech reads badly', () => {
    expect(speechProblems('Find (3 + 4) × 2.').join()).toMatch(/can't say "\("/);
    expect(speechProblems('Is 5 < 7?').join()).toMatch(/can't say "<"/);
    expect(speechProblems('She came 3rd.').join()).toMatch(/ordinals/);
    expect(speechProblems('At 3:30 we eat.').join()).toMatch(/colons/);
    expect(speechProblems('There were 1,000 fans.').join()).toMatch(/commas/);
    expect(speechProblems('Pick from 1-10.').join()).toMatch(/dash between numbers/);
    expect(speechProblems('Look - a frog!').join()).toMatch(/read as "minus"/);
    expect(speechProblems('Count the 🍎.').join()).toMatch(/emoji/);
    expect(speechProblems('3×4 is twelve.').join()).toMatch(/can't say "×"/);
    expect(speechProblems('Speed is 5 km/h.').join()).toMatch(/can't say "\/"/);
  });
});

describe('riskyProblems', () => {
  it('flags answers the app cannot take, like the graph check', () => {
    expect(riskyProblems('Say the number out loud.')).toHaveLength(2);
    expect(riskyProblems('Draw 3 circles.')[0]).toMatch(/"draw"/);
    expect(riskyProblems('Explain your thinking.')[0]).toMatch(/"explain"/);
    expect(riskyProblems('Tell how many frogs there are.')).toEqual([]);
    expect(riskyProblems('Tap the bigger number.')).toEqual([]);
  });
});
