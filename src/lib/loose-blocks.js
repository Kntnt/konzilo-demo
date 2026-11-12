// A body's loose blocks in a section of their own, as a page's template writes them (Konzilo Design's
// docs/spec/directives.md, The body of a page): a run of blocks at the top level outside a hero or a section stands
// as a section without a Surface, as if the editor had put `:::section` around it, so that a list of logos between two
// sections stands in a band of its own. The core's Body takes a body's HTML, and finds a directive as its plain
// rendering, a <div data-directive="…">, so the run is wrapped in a section's plain rendering before Body draws it
// with Konzilo Design's component.

// The directives that are bands of their own at the top level of a body.
const BANDS = new Set(['hero', 'section']);
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style', 'textarea', 'title']);

// The opening tag at `at`, read past quoted attribute values: its name, where it ends, whether it closes itself, and
// the directive it is the plain rendering of, if any.
function openingTag(html, at) {
  const name = /^<([a-zA-Z][^\s/>]*)/.exec(html.slice(at, at + 64))[1].toLowerCase();
  let quote = null;
  let i = at + 1 + name.length;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === '>') {
      break;
    }
  }
  const text = html.slice(at, i + 1);
  return { name, end: i + 1, closed: text.endsWith('/>') || VOID.has(name), directive: /\sdata-directive="([^"]*)"/.exec(text)?.[1] };
}

// Where a raw text element's content ends, after its closing tag.
const afterClosing = (html, name, from) => {
  const close = html.indexOf(`</${name}`, from);
  return close === -1 ? html.length : html.indexOf('>', close) + 1;
};

// Where the element whose opening tag is at `at` ends, after its closing tag.
function elementEnd(html, at) {
  const first = openingTag(html, at);
  if (first.closed) return first.end;
  if (RAW.has(first.name)) return afterClosing(html, first.name, first.end);
  let depth = 1;
  let i = first.end;
  while (depth > 0) {
    const lt = html.indexOf('<', i);
    if (lt === -1) return html.length;
    if (html.startsWith('<!--', lt)) {
      i = html.indexOf('-->', lt) + 3;
    } else if (html[lt + 1] === '/') {
      depth -= 1;
      i = html.indexOf('>', lt) + 1;
    } else if (/[a-zA-Z]/.test(html[lt + 1] ?? '')) {
      const tag = openingTag(html, lt);
      i = RAW.has(tag.name) ? afterClosing(html, tag.name, tag.end) : tag.end;
      if (!tag.closed && !RAW.has(tag.name)) depth += 1;
    } else {
      i = lt + 1;
    }
  }
  return i;
}

// The body's HTML with each run of top-level blocks outside a hero or a section in a section's plain rendering.
export function withLooseBlocksInSections(html) {
  let out = '';
  let run = '';
  const flush = () => {
    out += run.replace(/<!--[\s\S]*?-->/g, '').trim() ? `<div data-directive="section">${run}</div>` : run;
    run = '';
  };
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) {
      run += html.slice(i);
      break;
    }
    run += html.slice(i, lt);
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt) + 3;
      run += html.slice(lt, end);
      i = end;
    } else if (/[a-zA-Z]/.test(html[lt + 1] ?? '')) {
      const end = elementEnd(html, lt);
      if (BANDS.has(openingTag(html, lt).directive)) {
        flush();
        out += html.slice(lt, end);
      } else {
        run += html.slice(lt, end);
      }
      i = end;
    } else {
      run += '<';
      i = lt + 1;
    }
  }
  flush();
  return out;
}
