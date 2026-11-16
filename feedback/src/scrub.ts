const REMOVED = '[removed]';

const TLDS = 'com|net|org|edu|gov|ca|us|uk|io|co|app|dev|info|me|ly|gg|tv|ai|xyz|biz';

// Order matters: emails go before URLs, so `name@site.com` doesn't leave `name@`.
const PATTERNS: RegExp[] = [
  /[\w.%+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /\b(?:https?:\/\/|www\.)\S+/gi,
  new RegExp(String.raw`\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:${TLDS})\b(?:/\S*)?`, 'gi'),
  /\b[a-z]\d[a-z][ -]?\d[a-z]\d\b/gi,
  /\b\d{5}-\d{4}\b/g,
  /\+\d[\d\s().-]{6,}\d/g,
  /(?:\b\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\b\d{3})[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  /\d{6,}/g,
];

const ZWSP = String.fromCharCode(0x200b);

// A zero-width space after `@` or `#` keeps the text readable but stops GitHub linking it.
const unlink = (text: string) => text.replace(/(^|[^\w])([@#])(?=[\w-])/g, `$1$2${ZWSP}`);

/**
 * Removes emails, phone numbers, postal codes, URLs, and runs of 6+ digits from a tester's text,
 * and breaks `@mentions` and `#123` references so a public issue notifies and links no one.
 */
export function scrub(text: string): string {
  let out = text;
  for (const pattern of PATTERNS) out = out.replace(pattern, REMOVED);
  return unlink(out);
}

/** Text safe inside Markdown: no HTML, so it can't fake a marker or open a `<details>`. */
export const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** A table cell: one line, no pipes, no code spans, no mentions. */
export const cell = (text: string) =>
  unlink(
    escapeHtml(text)
      .replace(/\s+/g, ' ')
      .replace(/([|`\\*_[\]])/g, '\\$1'),
  );

/** A fence longer than any backtick run in the text, so the text can't close it. */
export function fence(text: string, info = ''): string {
  const longest = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length));
  const ticks = '`'.repeat(Math.max(3, longest + 1));
  return `${ticks}${info}\n${text}\n${ticks}`;
}
