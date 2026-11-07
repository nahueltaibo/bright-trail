import { describe, expect, it } from 'vitest';
import { integerToWords, toSpeech } from './to-speech';

describe('integerToWords', () => {
  it.each([
    ['0', 'zero'],
    ['7', 'seven'],
    ['13', 'thirteen'],
    ['20', 'twenty'],
    ['45', 'forty-five'],
    ['100', 'one hundred'],
    ['638', 'six hundred thirty-eight'],
    ['1000', 'one thousand'],
    ['8621', 'eight thousand six hundred twenty-one'],
    ['24336', 'twenty-four thousand three hundred thirty-six'],
    ['100000', 'one hundred thousand'],
    ['527910', 'five hundred twenty-seven thousand nine hundred ten'],
    ['1000000', 'one million'],
    ['1000001', 'one million one'],
    ['007', 'seven'],
  ])('%s → %s', (digits, words) => {
    expect(integerToWords(digits)).toBe(words);
  });
});

describe('toSpeech', () => {
  it.each([
    // Spaced thousands
    ['10 000', 'ten thousand'],
    ['24 336', 'twenty-four thousand three hundred thirty-six'],
    ['1 000 000', 'one million'],
    [
      'the 5 in 527 910 is 500 000',
      'the five in five hundred twenty-seven thousand nine hundred ten is five hundred thousand',
    ],
    [
      '8621 is 8000 + 600 + 20 + 1',
      'eight thousand six hundred twenty-one is eight thousand plus six hundred plus twenty plus one',
    ],
    // Fractions
    ['3/4', 'three fourths'],
    ['1/2', 'one half'],
    ['3/2', 'three halves'],
    ['1/3', 'one third'],
    ['5/8', 'five eighths'],
    ['7/10', 'seven tenths'],
    ['1/12', 'one twelfth'],
    ['3/20', 'three twentieths'],
    ['4/1', 'four wholes'],
    ['2 1/3', 'two and one third'],
    ['1 3/4', 'one and three fourths'],
    ['6 ÷ 3/4 = 8', 'six divided by three fourths equals eight'],
    // Negatives and subtraction
    ['-6', 'negative six'],
    ['−4 and 4', 'negative four and four'],
    ['between -3 and 2', 'between negative three and two'],
    ['-3/4', 'negative three fourths'],
    ['10 - 4 is 6', 'ten minus four is six'],
    // Decimals
    ['3.25', 'three point two five'],
    ['0.04', 'zero point zero four'],
    ['24.7', 'twenty-four point seven'],
    ['3.555…', 'three point five five five repeating'],
    ['0.333...', 'zero point three three three repeating'],
    ['Round 56.25.', 'Round fifty-six point two five.'],
    // Percents
    ['25%', 'twenty-five percent'],
    ['10% of 350', 'ten percent of three hundred fifty'],
    ['12.5%', 'twelve point five percent'],
    // Money
    ['$10', 'ten dollars'],
    ['$1', 'one dollar'],
    ['$2.50', 'two dollars and fifty cents'],
    ['$0.75', 'seventy-five cents'],
    ['$1 000', 'one thousand dollars'],
    ['25¢', 'twenty-five cents'],
    ['1¢', 'one cent'],
    // Skip counting and operators
    ['count by 5s and 10s', 'count by fives and tens'],
    ['by 1s, 2s, 6s, 20s, 25s', 'by ones, twos, sixes, twenties, twenty-fives'],
    ['24 × 38', 'twenty-four times thirty-eight'],
  ])('%s → %s', (text, speech) => {
    expect(toSpeech(text)).toBe(speech);
  });

  it('leaves text without numbers alone', () => {
    const text = 'Share things so every friend gets the same amount!';
    expect(toSpeech(text)).toBe(text);
  });

  it('keeps commas that separate numbers in a list', () => {
    expect(toSpeech('like 7, 8, 9, and keep going to 20')).toBe(
      'like seven, eight, nine, and keep going to twenty',
    );
  });

  it("doesn't read an ellipsis after a whole number as repeating", () => {
    expect(toSpeech('1, 2, 3...')).toBe('one, two, three...');
  });

  it('leaves codes and hyphenated words alone', () => {
    expect(toSpeech('B2.3 is two-digit')).toBe('B2.3 is two-digit');
  });

  it('reads a whole skill description', () => {
    expect(
      toSpeech(
        'Divide decimals like 0.8 or 3.24 by a whole number up to 10, as in 0.24 ÷ 6 = 0.04.',
      ),
    ).toBe(
      'Divide decimals like zero point eight or three point two four by a whole number up to ten, as in zero point two four divided by six equals zero point zero four.',
    );
  });
});
