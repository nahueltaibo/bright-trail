const ONES = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const SCALES = ['', 'thousand', 'million', 'billion', 'trillion'];

function underThousand(n: number): string {
  const words: string[] = [];
  if (n >= 100) {
    words.push(`${ONES[Math.floor(n / 100)]} hundred`);
    n %= 100;
  }
  if (n >= 20) {
    words.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''));
  } else if (n > 0) {
    words.push(ONES[n]);
  }
  return words.join(' ');
}

/** Words for a whole number written as digits, e.g. `"24336"` → "twenty-four thousand three hundred thirty-six". */
export function integerToWords(digits: string): string {
  const clean = digits.replace(/^0+(?=\d)/, '');
  if (/^0+$/.test(clean)) return 'zero';
  const groups: number[] = [];
  for (let end = clean.length; end > 0; end -= 3) {
    groups.unshift(Number(clean.slice(Math.max(0, end - 3), end)));
  }
  // Past the named scales, reading digit by digit is still understandable.
  if (groups.length > SCALES.length) return [...clean].map((d) => ONES[Number(d)]).join(' ');
  return groups
    .map((group, i) => {
      const scale = SCALES[groups.length - 1 - i];
      return group === 0 ? '' : `${underThousand(group)}${scale ? ` ${scale}` : ''}`;
    })
    .filter(Boolean)
    .join(' ');
}

const ORDINAL_ENDINGS: Record<string, string> = {
  one: 'first',
  two: 'second',
  three: 'third',
  five: 'fifth',
  eight: 'eighth',
  nine: 'ninth',
  twelve: 'twelfth',
};

function ordinal(words: string): string {
  const match = /([a-z]+)$/.exec(words)!;
  const last = match[1];
  const ending =
    ORDINAL_ENDINGS[last] ?? (last.endsWith('y') ? `${last.slice(0, -1)}ieth` : `${last}th`);
  return words.slice(0, match.index) + ending;
}

function plural(words: string): string {
  if (words.endsWith('x')) return `${words}es`;
  if (words.endsWith('y')) return `${words.slice(0, -1)}ies`;
  return `${words}s`;
}

function fractionWords(numerator: string, denominator: string): string {
  const top = integerToWords(numerator);
  const one = Number(numerator) === 1;
  if (Number(denominator) === 1) return `${top} ${one ? 'whole' : 'wholes'}`;
  if (Number(denominator) === 2) return `${top} ${one ? 'half' : 'halves'}`;
  const bottom = ordinal(integerToWords(denominator));
  return `${top} ${one ? bottom : plural(bottom)}`;
}

const digitWords = (digits: string) => [...digits].map((d) => ONES[Number(d)]).join(' ');
const unspace = (digits: string) => digits.replace(/ /g, '');

function decimalWords(whole: string, fraction: string | undefined): string {
  const words = integerToWords(unspace(whole));
  return fraction === undefined ? words : `${words} point ${digitWords(fraction)}`;
}

function moneyWords(whole: string, cents: string | undefined): string {
  const dollars = Number(unspace(whole));
  if (cents !== undefined && cents.length !== 2) {
    return `${decimalWords(whole, cents)} dollars`;
  }
  const parts: string[] = [];
  if (dollars > 0 || !cents || Number(cents) === 0) {
    parts.push(`${integerToWords(unspace(whole))} ${dollars === 1 ? 'dollar' : 'dollars'}`);
  }
  if (cents && Number(cents) > 0) {
    parts.push(`${integerToWords(cents)} ${Number(cents) === 1 ? 'cent' : 'cents'}`);
  }
  return parts.join(' and ');
}

// Ontario math writes thousands with a space ("10 000"), so a whole number may hold spaced
// groups of exactly three digits.
const WHOLE = String.raw`\d{1,3}(?: \d{3})+(?![\d\w])|\d+`;
const NOT_AFTER_NUMBER = String.raw`(?<![\w/.])`;
const NOT_BEFORE_NUMBER = String.raw`(?![\d/])`;

const TOKEN = new RegExp(
  [
    String.raw`\$(?<dollars>${WHOLE})(?:\.(?<cents>\d+))?`,
    String.raw`${NOT_AFTER_NUMBER}(?<centsOnly>\d+) ?¢`,
    String.raw`${NOT_AFTER_NUMBER}(?<mixedWhole>\d+) (?<mixedTop>\d+)\/(?<mixedBottom>\d+)${NOT_BEFORE_NUMBER}`,
    String.raw`${NOT_AFTER_NUMBER}(?<top>\d+)\/(?<bottom>\d+)${NOT_BEFORE_NUMBER}`,
    String.raw`(?<sign>(?<![\w).])[-−](?=\d))`,
    String.raw`${NOT_AFTER_NUMBER}(?<count>\d+)s\b`,
    String.raw`${NOT_AFTER_NUMBER}(?<whole>${WHOLE})(?:\.(?<decimals>\d+))?(?<repeat>…|\.\.\.)?(?<percent> ?%)?`,
    String.raw`(?<operator> [×÷=+−-] )`,
  ].join('|'),
  'g',
);

const OPERATORS: Record<string, string> = {
  '×': 'times',
  '÷': 'divided by',
  '=': 'equals',
  '+': 'plus',
  '-': 'minus',
  '−': 'minus',
};

/**
 * Rewrites Ontario math formatting as words, so device text-to-speech reads it the way a teacher
 * would: "24 336" → "twenty-four thousand three hundred thirty-six", "3/4" → "three fourths",
 * "-6" → "negative six", "3.555…" → "three point five five five repeating", "$2.50" → "two
 * dollars and fifty cents". Text without numbers comes back unchanged.
 */
export function toSpeech(text: string): string {
  return text.replace(TOKEN, (...args) => {
    const g = args.at(-1) as Record<string, string | undefined>;
    if (g.dollars !== undefined) return moneyWords(g.dollars, g.cents);
    if (g.centsOnly !== undefined) {
      return `${integerToWords(g.centsOnly)} ${Number(g.centsOnly) === 1 ? 'cent' : 'cents'}`;
    }
    if (g.mixedWhole !== undefined) {
      return `${integerToWords(g.mixedWhole)} and ${fractionWords(g.mixedTop!, g.mixedBottom!)}`;
    }
    if (g.top !== undefined) return fractionWords(g.top, g.bottom!);
    if (g.sign !== undefined) return 'negative ';
    if (g.count !== undefined) return plural(integerToWords(g.count));
    if (g.whole !== undefined) {
      let words = decimalWords(g.whole, g.decimals);
      // An ellipsis after a whole number ends a list, not a repeating decimal.
      if (g.repeat) words += g.decimals === undefined ? g.repeat : ' repeating';
      if (g.percent) words += ' percent';
      return words;
    }
    return ` ${OPERATORS[g.operator!.trim()]} `;
  });
}
