import { describe, expect, it } from 'vitest';
import { htmlToMarkdown } from './html';

describe('htmlToMarkdown', () => {
  it('keeps paragraphs, emphasis, and link text', () => {
    expect(
      htmlToMarkdown(
        '<p>use a <a href="/x">research process</a>, <strong>safely</strong></p><p>Next&nbsp;one &amp; more</p>',
      ),
    ).toBe('use a research process, **safely**\n\nNext one & more');
  });

  it('nests lists two spaces deep', () => {
    expect(
      htmlToMarkdown(
        '<ul>\n <li><strong>roles:</strong>\n <ul><li>student</li><li>friend</li></ul></li><li>last</li></ul>',
      ),
    ).toBe('- **roles:**\n  - student\n  - friend\n- last');
  });

  it('joins emphasis split around links and drops emphasis inside emphasis', () => {
    expect(
      htmlToMarkdown(
        '<p><em>modify </em><a href=""><em>percussive movements</em></a><em> such as <strong>this</strong></em></p>',
      ),
    ).toBe('*modify percussive movements such as this*');
    expect(htmlToMarkdown('<p>(<a><strong>FOCUS ON</strong></a><strong>:</strong> x)</p>')).toBe(
      '(**FOCUS ON:** x)',
    );
  });

  it('turns tables into Markdown tables', () => {
    expect(
      htmlToMarkdown(
        '<table><tbody><tr><td><strong>Topic</strong></td><td>D1</td></tr><tr><td>Eating</td><td>a | b</td></tr></tbody></table>',
      ),
    ).toBe('| **Topic** | D1 |\n|---|---|\n| Eating | a \\| b |');
  });

  it('renders embedded items through the resolver', () => {
    const html =
      '<p>Before</p><object type="application/kenticocloud" data-codename="note"></object>';
    expect(htmlToMarkdown(html, (c) => `[${c}]`)).toBe('Before\n\n[note]');
    expect(() => htmlToMarkdown(html)).toThrow('Rich text embeds note');
  });

  it('bolds headings and keeps image alt text', () => {
    expect(htmlToMarkdown('<h4><strong>Looks like...</strong></h4><p><img alt="A frog"></p>')).toBe(
      '**Looks like...**\n\n[Image: A frog]',
    );
  });
});
