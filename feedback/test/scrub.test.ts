import { describe, expect, it } from 'vitest';
import { cell, fence, scrub } from '../src/scrub';

const R = '[removed]';
const [ZWSP, WORD_JOINER, SOFT_HYPHEN] = [0x200b, 0x2060, 0xad].map((c) => String.fromCharCode(c));

describe('scrub', () => {
  it.each([
    ['Write to jane.doe+kids@example.co.uk please', `Write to ${R} please`],
    ['Call 416-555-1234 or (416) 555 1234', `Call ${R} or ${R}`],
    ['Call +44 20 7946 0958 today', `Call ${R} today`],
    ['We live at M5V 2T6 and m5v2t6', `We live at ${R} and ${R}`],
    ['ZIP 90210-1234', `ZIP ${R}`],
    ['See https://example.com/a?b=1 and www.site.org', `See ${R} and ${R}`],
    ['Go to example.com/path or school.on.ca', `Go to ${R} or ${R}`],
    ['Card 4111111111111111 and id 123456', `Card ${R} and id ${R}`],
    ['Open ftp://files.host/x or myapp://open', `Open ${R} or ${R}`],
    [`Mail mom@exa${ZWSP}mple.com or 416${WORD_JOINER}555${SOFT_HYPHEN}1234`, `Mail ${R} or ${R}`],
  ])('removes contact details from %j', (input, output) => {
    expect(scrub(input)).toBe(output);
  });

  it('keeps ordinary math talk', () => {
    const text = 'It said 7 + 5 = 12, but 12345 is not 1,000. Also e.g. halves.';
    expect(scrub(text)).toBe(text);
  });

  it('breaks mentions and issue links without hiding them', () => {
    const text = 'Ask @octocat about #12, @org/team, org/repo#3, and word#12';
    const out = scrub(text);
    expect(out).not.toMatch(/@\w|#\d/);
    expect(out.replace(/\u200B/g, '')).toBe(text);
  });
});

describe('markdown helpers', () => {
  it('keeps a cell on one line with no pipes, HTML, or code spans', () => {
    expect(cell('a|b\n<i>`x`</i>')).toBe('a\\|b &lt;i&gt;\\`x\\`&lt;/i&gt;');
  });

  it('fences with more backticks than the text holds', () => {
    expect(fence('a ```` b', 'json')).toBe('`````json\na ```` b\n`````');
  });
});
