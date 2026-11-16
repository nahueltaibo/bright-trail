const REMOVED = '[removed]';

const TLDS = 'com|net|org|edu|gov|ca|us|uk|io|co|app|dev|info|me|ly|gg|tv|ai|xyz|biz';

// Order matters: emails go before URLs, so `name@site.com` doesn't leave `name@`. Bounded runs
// keep a long untrusted string from backtracking for seconds.
const PATTERNS: RegExp[] = [
  /[\w.%+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63})+/g,
  /\b(?:[a-z][a-z0-9+.-]{0,31}:\/\/|www\.)\S+/gi,
  new RegExp(String.raw`\b[a-z0-9-]{1,63}(?:\.[a-z0-9-]{1,63})*\.(?:${TLDS})\b(?:/\S*)?`, 'gi'),
  /\b[a-z]\d[a-z][ -]?\d[a-z]\d\b/gi,
  /\b\d{5}-\d{4}\b/g,
  /\+\d[\d\s().-]{6,}\d/g,
  /(?:\b\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\d{6,}/g,
];

const ZWSP = String.fromCharCode(0x200b);

// A zero-width space after every `@` or `#` keeps the text readable but stops GitHub linking it,
// as in `@user`, `org/repo#3`, or `word#12`.
const unlink = (text: string) => text.replace(/([@#])(?=[\w-])/g, `$1${ZWSP}`);

// Invisible characters could split a pattern, as in an email with a zero-width space inside.
const INVISIBLE = /\p{Cf}/gu;

/** Removes emails, phone numbers, postal codes, URLs, and runs of 6+ digits, and breaks mentions. */
export function scrub(text: string): string {
  let out = text.replace(INVISIBLE, '');
  for (const pattern of PATTERNS) out = out.replace(pattern, REMOVED);
  return unlink(out);
}

/** Text safe inside Markdown: no HTML, so it can't fake a marker or open a `<details>`. */
export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CELL_MAX = 1_000;

/** A table cell from untrusted text: scrubbed, one line, capped, with no pipes or code spans. */
export function cell(text: string): string {
  const line = scrub(text).replace(/\s+/g, ' ');
  const short = line.length > CELL_MAX ? `${line.slice(0, CELL_MAX)}…` : line;
  return escapeHtml(short).replace(/([|`\\*_[\]])/g, '\\$1');
}

/** A fence longer than any backtick run in the text, so the text can't close it. */
export function fence(text: string, info = ''): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}${info}\n${text}\n${ticks}`;
}
