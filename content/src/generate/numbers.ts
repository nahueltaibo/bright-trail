import { Rational } from './rational';

const SMALL = [
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

/** Value of a number word from zero to ninety-nine, e.g. "forty-two". */
export function numberWord(word: string): number | null {
  const w = word.toLowerCase();
  const small = SMALL.indexOf(w);
  if (small >= 0) return small;
  const [tens, ones] = w.split('-');
  const t = TENS.indexOf(tens);
  if (t < 2) return null;
  if (ones === undefined) return t * 10;
  const o = SMALL.indexOf(ones);
  return o >= 1 && o <= 9 ? t * 10 + o : null;
}

const r = (n: bigint, d = 1n) => new Rational(n, d);
const unspace = (s: string) => s.replace(/[ \u00a0]/g, '');
// Ontario writes thousands with a space ("10 000"). A plain run of digits also counts.
const WHOLE = String.raw`\d{1,3}(?:[ \u00a0]\d{3})+|\d+`;

/**
 * Every value a whole answer-choice text can mean, most natural first, or null when the text is
 * not one number. "25%" may mean 0.25 or 25, and "$2.50" may mean 2.5 dollars or 250 cents.
 */
export function parseNumberText(text: string): Rational[] | null {
  const t = text.trim().replace(/−/g, '-');
  let m = new RegExp(String.raw`^(-?)(${WHOLE})(?:\.(\d+))?$`).exec(t);
  if (m) {
    const value = Rational.parse(`${m[1]}${unspace(m[2])}${m[3] ? `.${m[3]}` : ''}`)!;
    return [value];
  }
  m = /^(-?)(\d+)\/(\d+)$/.exec(t);
  if (m && m[3] !== '0') {
    const value = r(BigInt(m[2]), BigInt(m[3]));
    return [m[1] ? value.neg() : value];
  }
  m = /^(-?)(\d+) (?:and )?(\d+)\/(\d+)$/.exec(t);
  if (m && m[4] !== '0') {
    const value = r(BigInt(m[2])).add(r(BigInt(m[3]), BigInt(m[4])));
    return [m[1] ? value.neg() : value];
  }
  m = new RegExp(String.raw`^(-?)(${WHOLE}(?:\.\d+)?) ?%$`).exec(t);
  if (m) {
    const value = Rational.parse(`${m[1]}${unspace(m[2])}`)!;
    return [value.div(r(100n)), value];
  }
  m = new RegExp(String.raw`^\$(${WHOLE}(?:\.\d+)?)$`).exec(t);
  if (m) {
    const dollars = Rational.parse(unspace(m[1]))!;
    return [dollars, dollars.mul(r(100n))];
  }
  m = /^(\d+) ?¢$/.exec(t);
  if (m) {
    const cents = r(BigInt(m[1]));
    return [cents, cents.div(r(100n))];
  }
  const word = numberWord(t.replace(/[.!?]$/, ''));
  return word === null ? null : [r(BigInt(word))];
}

/**
 * Numbers a text mentions, in digits or words, with each fraction's parts and value and each
 * percent as both 25 and 0.25. Used to tie an answer check's literals to the question.
 */
export function numbersMentioned(text: string): Rational[] {
  const found: Rational[] = [];
  const t = text.replace(/−/g, '-');
  for (const m of t.matchAll(/(\d+)\/(\d+)/g)) {
    found.push(r(BigInt(m[1])), r(BigInt(m[2])));
    if (m[2] !== '0') found.push(r(BigInt(m[1]), BigInt(m[2])));
  }
  const numberPattern = new RegExp(String.raw`(-?)(${WHOLE})(?:\.(\d+))?( ?%)?`, 'g');
  for (const m of t.matchAll(numberPattern)) {
    const value = Rational.parse(`${unspace(m[2])}${m[3] ? `.${m[3]}` : ''}`)!;
    found.push(value);
    if (m[1]) found.push(value.neg());
    if (m[4]) found.push(value.div(r(100n)));
    // "4 000" also mentions 4 and 000 to a reader who doesn't group digits.
    if (/[ \u00a0]/.test(m[2]))
      for (const part of m[2].split(/[ \u00a0]/)) found.push(r(BigInt(part)));
  }
  for (const m of t.matchAll(/[a-z]+(?:-[a-z]+)?/gi)) {
    const word = numberWord(m[0]);
    if (word !== null) found.push(r(BigInt(word)));
  }
  if (/\bhalf\b|\bhalves\b/i.test(t)) found.push(r(1n, 2n), r(2n));
  if (/\bhundred\b/i.test(t)) found.push(r(100n));
  if (/\bthousand\b/i.test(t)) found.push(r(1000n));
  if (/\bdozen\b/i.test(t)) found.push(r(12n));
  return found;
}
