import type { SampleLine } from './lines';

export interface PageVoice {
  id: string;
  name: string;
}

export interface PageData {
  lines: SampleLine[];
  voices: PageVoice[];
  /** Clip file, relative to the page, by line id then voice id. A missing clip failed to render. */
  clips: Record<string, Record<string, string>>;
  /** Providers left out, with the reason, listed at the top of the page. */
  skipped: string[];
}

const escapeHtml = (text: string) =>
  text.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);

/**
 * One page that plays every clip. Each voice gets a letter, shuffled on every load, so the
 * listener can't tell providers apart until "Reveal".
 */
export function buildPage(data: PageData): string {
  // `<\/` keeps a line's text from closing the script tag early.
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  const skipped = data.skipped.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Narration voices</title>
<link rel="icon" href="data:,">
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1f2937; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border-bottom: 1px solid #e5e7eb; padding: .5rem; text-align: left; vertical-align: top; }
  .text { min-width: 16rem; max-width: 28rem; }
  audio { width: 12rem; }
  .spoken { color: #6b7280; font-size: .85rem; }
  .clip { display: flex; flex-direction: column; gap: .25rem; }
  .who { display: none; font-size: .8rem; color: #9333ea; }
  body.revealed .who { display: block; }
  button { font-size: 1rem; padding: .5rem 1rem; margin-right: .5rem; }
  .missing { color: #b91c1c; font-size: .85rem; }
</style>
</head>
<body>
<h1>Narration voices</h1>
<p>Play each line and pick a favourite voice. Letters shuffle on every reload.</p>
${skipped ? `<p>Skipped:</p><ul>${skipped}</ul>` : ''}
<p>
  <button id="shuffle">Shuffle</button>
  <button id="reveal">Reveal</button>
</p>
<table>
  <thead><tr id="head"><th>Line</th></tr></thead>
  <tbody id="rows"></tbody>
</table>
<script id="data" type="application/json">${json}</script>
<script>
  const data = JSON.parse(document.getElementById('data').textContent);
  const el = (tag, props = {}, kids = []) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...kids);
    return node;
  };
  function render() {
    const order = data.voices.map((v) => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map((p) => p[1]);
    const letter = (i) => 'Voice ' + String.fromCharCode(65 + i);
    const head = document.getElementById('head');
    head.replaceChildren(el('th', { textContent: 'Line' }), ...order.map((v, i) =>
      el('th', {}, [letter(i), el('div', { className: 'who', textContent: v.name })])));
    document.getElementById('rows').replaceChildren(...data.lines.map((line) => el('tr', {}, [
      el('td', { className: 'text' }, [
        el('strong', { textContent: line.label }),
        el('div', { textContent: line.written }),
        el('div', { className: 'spoken', textContent: 'Read as: ' + line.spoken }),
      ]),
      ...order.map((v, i) => {
        const file = data.clips[line.id]?.[v.id];
        return el('td', {}, [el('div', { className: 'clip' }, [
          el('span', { textContent: letter(i) }),
          file
            ? el('audio', { controls: true, preload: 'none', src: file })
            : el('span', { className: 'missing', textContent: 'No clip' }),
          el('span', { className: 'who', textContent: v.name }),
        ])]);
      }),
    ])));
  }
  document.getElementById('shuffle').onclick = () => {
    document.body.classList.remove('revealed');
    render();
  };
  document.getElementById('reveal').onclick = () => document.body.classList.toggle('revealed');
  render();
</script>
</body>
</html>
`;
}
