/** A curriculum item's Markdown, looked up by codename when rich text embeds it. */
export type ResolveObject = (codename: string) => string;

interface Element {
  tag: string;
  attrs: Record<string, string>;
  children: Node[];
}
type Node = Element | string;

const VOID = new Set(['br', 'img', 'hr', 'col']);
const BLOCK = new Set([
  'p',
  'div',
  'ul',
  'ol',
  'table',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'object',
]);

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
  ndash: '–',
  mdash: '—',
  hellip: '…',
};

function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return code === 160 ? ' ' : String.fromCodePoint(code);
    }
    return ENTITIES[name.toLowerCase()] ?? whole;
  });
}

function parse(html: string): Element {
  const root: Element = { tag: 'root', attrs: {}, children: [] };
  const stack = [root];
  for (const m of html.matchAll(/<!--[\s\S]*?-->|<(\/?)([a-zA-Z0-9]+)([^>]*?)(\/?)>|([^<]+)/g)) {
    const top = stack[stack.length - 1];
    if (m[5] !== undefined) {
      top.children.push(decode(m[5]));
      continue;
    }
    if (!m[2]) continue;
    const tag = m[2].toLowerCase();
    if (m[1]) {
      const at = stack.map((e) => e.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
      continue;
    }
    const attrs: Record<string, string> = {};
    for (const a of m[3].matchAll(/([\w-]+)="([^"]*)"/g)) attrs[a[1].toLowerCase()] = decode(a[2]);
    const el: Element = { tag, attrs, children: [] };
    top.children.push(el);
    if (!VOID.has(tag) && !m[4]) stack.push(el);
  }
  return root;
}

function wrap(mark: string, text: string): string {
  const inner = text.trim();
  if (!inner) return text;
  const lead = text.match(/^\s*/)![0] ? ' ' : '';
  const trail = text.match(/\s*$/)![0] ? ' ' : '';
  return `${lead}${mark}${inner}${mark}${trail}`;
}

const MARKS: Record<string, string> = { strong: '**', b: '**', em: '*', i: '*' };

/** Turns `<a><em>x</em></a>` into `<em><a>x</a></em>`, so the mark can join its neighbours. */
function hoist(node: Node): Node {
  if (typeof node === 'string' || MARKS[node.tag] || !/^(a|span|u|sup|sub)$/.test(node.tag)) {
    return node;
  }
  const solid = node.children.filter((c) => typeof c !== 'string' || c.trim());
  const only = solid.length === 1 ? hoist(solid[0]) : null;
  if (!only || typeof only === 'string' || !MARKS[only.tag]) return node;
  return { ...only, children: [{ ...node, children: only.children }] };
}

/** Joins runs like `<em>a </em><em>b</em>`, which the source splits around links. */
function mergeMarks(input: Node[]): Node[] {
  const nodes = input.map(hoist);
  const out: Node[] = [];
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (typeof n === 'string' || !MARKS[n.tag]) {
      out.push(n);
      continue;
    }
    const merged: Element = { ...n, children: [...n.children] };
    let j = i + 1;
    for (; j < nodes.length; j++) {
      const next = nodes[j];
      const gap = typeof next === 'string' && !next.trim() ? next : null;
      const after = gap !== null ? nodes[j + 1] : next;
      if (typeof after === 'string' || !after || MARKS[after.tag] !== MARKS[n.tag]) break;
      if (gap !== null) {
        merged.children.push(gap);
        j++;
      }
      merged.children.push(...after.children);
    }
    out.push(merged);
    i = j - 1;
  }
  return out;
}

/** Markdown can't nest emphasis cleanly, so marks inside a mark render plain. */
function inline(nodes: Node[], marked = false): string {
  let out = '';
  for (const n of mergeMarks(nodes)) {
    if (typeof n === 'string') {
      out += n.replace(/\s+/g, ' ');
      continue;
    }
    const mark = MARKS[n.tag];
    if (n.tag === 'br') out += '\n';
    else if (mark && !marked) out += wrap(mark, inline(n.children, true));
    else if (n.tag === 'img') out += n.attrs.alt ? `[Image: ${n.attrs.alt}]` : '';
    else out += inline(n.children, marked);
  }
  return out;
}

function cleanLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.replace(/ {2,}/g, ' ').trim())
    .filter(Boolean);
}

function list(el: Element, depth: number, resolve: ResolveObject): string {
  const lines: string[] = [];
  const pad = '  '.repeat(depth);
  let n = 1;
  for (const li of el.children) {
    if (typeof li === 'string' || li.tag !== 'li') continue;
    const bullet = el.tag === 'ol' ? `${n++}.` : '-';
    const text: Node[] = [];
    const nested: string[] = [];
    for (const c of li.children) {
      if (typeof c !== 'string' && (c.tag === 'ul' || c.tag === 'ol'))
        nested.push(list(c, depth + 1, resolve));
      else if (typeof c !== 'string' && c.tag === 'p') text.push(...c.children, '\n');
      else text.push(c);
    }
    const [first = '', ...rest] = cleanLines(inline(text));
    lines.push(`${pad}${bullet} ${first}`.trimEnd());
    for (const r of rest) lines.push(`${pad}  ${r}`);
    lines.push(...nested);
  }
  return lines.join('\n');
}

function table(el: Element, resolve: ResolveObject): string {
  const rows: string[][] = [];
  const walk = (e: Element) => {
    for (const c of e.children) {
      if (typeof c === 'string') continue;
      if (c.tag === 'tr') {
        rows.push(
          c.children
            .filter((td): td is Element => typeof td !== 'string' && /^t[dh]$/.test(td.tag))
            .map((td) => cleanLines(blocks(td.children, resolve)).join(' ').replace(/\|/g, '\\|')),
        );
      } else walk(c);
    }
  };
  walk(el);
  if (rows.length === 0) return '';
  const width = Math.max(...rows.map((r) => r.length));
  const line = (r: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => r[i] ?? '').join(' | ')} |`;
  return [line(rows[0]), `|${'---|'.repeat(width)}`, ...rows.slice(1).map(line)].join('\n');
}

function block(n: Element, resolve: ResolveObject): string {
  if (n.tag === 'ul' || n.tag === 'ol') return list(n, 0, resolve);
  if (n.tag === 'table') return table(n, resolve);
  if (n.tag === 'object') return n.attrs['data-codename'] ? resolve(n.attrs['data-codename']) : '';
  if (/^h\d$/.test(n.tag)) return wrap('**', inline(n.children).replace(/\*\*/g, ''));
  return blocks(n.children, resolve);
}

function blocks(nodes: Node[], resolve: ResolveObject): string {
  const out: string[] = [];
  let run: Node[] = [];
  const flush = () => {
    const text = cleanLines(inline(run)).join('\n');
    if (text) out.push(text);
    run = [];
  };
  for (const n of nodes) {
    if (typeof n === 'string' || !BLOCK.has(n.tag)) {
      run.push(n);
      continue;
    }
    flush();
    const text = block(n, resolve).trim();
    if (text) out.push(text);
  }
  flush();
  return out.join('\n\n');
}

/** Converts the API's rich text to Markdown. Links keep their text and drop their target. */
export function htmlToMarkdown(html: string, resolve: ResolveObject = noObjects): string {
  return blocks(parse(html).children, resolve);
}

function noObjects(codename: string): string {
  throw new Error(`Rich text embeds ${codename}, but nothing resolves it`);
}
