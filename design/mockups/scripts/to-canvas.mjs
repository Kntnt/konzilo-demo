#!/usr/bin/env node
// Carries the built mockups onto the design canvas in Claude, "Ampfield Energy website": one live artboard per designed
// page, drawn from the page's own markup and stylesheet, and a second page of the same pages as screenshots.
//
//   node scripts/to-canvas.mjs --out <folder>                    convert; lists the files still to upload (written to
//                                                                <folder>/upload/), or writes the canvas's files to
//                                                                <folder>/project/, <folder> being the root to publish from
//   node scripts/to-canvas.mjs record --out <folder> <file> <url> [<file> <url> …]
//                                                                records uploads: a file as the list named it, and
//                                                                the /_blob/ address its upload returned
//   node scripts/to-canvas.mjs check --out <folder>              checks the canvas files against the artboard format
//   node scripts/to-canvas.mjs preview --out <folder> [<board> …] local check pages of artboards, screenshotted and
//                                                                compared with shots/ (default: four boards)
//   --index <file>   the canvas's project/canvas.json as read from the canvas: entries and keys the script does not
//                    own are kept (a revision of a canvas others have worked on)
//
// Build and shoot the pages first (README.md, Commands): an artboard is made from dist/, a frame's height and the
// second page from shots/. The record of uploads and the canvas's address is to-canvas.json beside this script.
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { userInfo, homedir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');
const SHOTS = join(ROOT, 'shots');
const RECORD = join(ROOT, 'scripts', 'to-canvas.json');

const TITLE = 'Ampfield Energy website';
const WINDOW = { 1440: 900, 390: 844 };        // the window shoot.mjs shoots in, and what 1vh is on the canvas
const MAX_FRAME = 8000;                          // the canvas's largest frame side
const GAP = 80;                                  // between frames in a row
const ROW_GAP = 400;                             // between rows: 120, and room for the row's title
const TITLE_ABOVE = 280;                         // a row title's top above its row
const PAGES = [{ id: 'design', name: 'Design' }, { id: 'screenshots', name: 'Screenshots' }];
const NOTE = 'The design of the Ampfield Energy demo site, drawn with the components of its design system. '
  + 'The page Screenshots holds the same pages as they render in a browser. '
  + 'Comments left on an artboard reach the people working on it.';

// The rows, as a person reads the site. A board is a built page at a width, with the header's menu or search box
// open where `state` says so; `name` is the page's name.
const ROWS = [
  { id: 'home', title: 'Home and the header', boards: [
    { page: 'home', width: 1440, name: 'Home' },
    { page: 'home', width: 390, name: 'Home' },
    { page: 'home', width: 1440, state: 'menu', name: 'Header, menu open' },
    { page: 'home', width: 390, state: 'menu', name: 'Header, menu open' },
    { page: 'home', width: 1440, state: 'search', name: 'Header, search open' },
    { page: 'home', width: 390, state: 'search', name: 'Header, search open' },
  ] },
  { id: 'solutions', title: 'Solutions and industries', boards: [
    { page: 'solutions', width: 1440, name: 'Solutions' },
    { page: 'solutions-rooftop-solar', width: 1440, name: 'Rooftop solar' },
    { page: 'solutions-rooftop-solar', width: 390, name: 'Rooftop solar' },
    { page: 'industries-logistics', width: 1440, name: 'Logistics and warehousing' },
  ] },
  { id: 'customers', title: 'Customers', boards: [
    { page: 'customers', width: 1440, name: 'Customers' },
    { page: 'customers-norrvik-logistics', width: 1440, name: 'Norrvik Logistics' },
  ] },
  { id: 'insights', title: 'Insights', boards: [
    { page: 'insights', width: 1440, name: 'Insights' },
    { page: 'insights-can-your-roof-carry-solar-panels', width: 1440, name: 'Can your roof carry solar panels?' },
    { page: 'insights-can-your-roof-carry-solar-panels', width: 390, name: 'Can your roof carry solar panels?' },
    { page: 'insights-category-guides', width: 1440, name: 'Guides' },
    { page: 'insights-author-priya-raman', width: 1440, name: 'Priya Raman' },
  ] },
  { id: 'about', title: 'About', boards: [
    { page: 'about', width: 1440, name: 'About us' },
    { page: 'about-team', width: 1440, name: 'Team' },
    { page: 'about-careers', width: 1440, name: 'Careers' },
    { page: 'about-careers-electrical-design-engineer-gothenburg', width: 1440, name: 'Electrical Design Engineer' },
  ] },
  { id: 'help', title: 'Help and legal', boards: [
    { page: 'contact', width: 1440, name: 'Contact' },
    { page: 'contact', width: 390, name: 'Contact' },
    { page: 'go-site-assessment', width: 1440, name: 'Book a site assessment' },
    { page: 'faq', width: 1440, name: 'Questions and answers' },
    { page: 'search', width: 1440, name: 'Search' },
    { page: 'not-found', width: 1440, name: 'Page not found' },
    { page: 'privacy-policy', width: 1440, name: 'Privacy policy' },
  ] },
];

// ---------------------------------------------------------------------------------------------------------------
// Arguments and the record

const args = process.argv.slice(2);
const option = (name) => { const at = args.indexOf(name); if (at < 0) return undefined; const [value] = args.splice(at, 2).slice(1); return value; };
const outArg = option('--out');
const indexArg = option('--index');
const dry = args.includes('--dry') && args.splice(args.indexOf('--dry'), 1);
const command = ['record', 'check', 'preview'].includes(args[0]) ? args.shift() : 'convert';
if (!outArg) { console.error('Name the folder to work in, outside the repository: --out <folder>'); process.exit(2); }
const OUT = resolve(outArg);
const UPLOAD = join(OUT, 'upload');
const PROJECT = join(OUT, 'project');

const record = existsSync(RECORD) ? JSON.parse(await readFile(RECORD, 'utf8')) : {};
record.uploads ??= {};
const saveRecord = async () => {
  const sorted = Object.fromEntries(Object.entries(record.uploads).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(RECORD, `${JSON.stringify({ ...record, uploads: sorted }, null, 2)}\n`);
};
const sha256 = (data) => createHash('sha256').update(data).digest('hex');
const dryUrl = (key) => `/_blob/dry-${sha256(key).slice(0, 16)}`;
const uploaded = async (key) => {
  if (dry) return dryUrl(key);
  const file = join(UPLOAD, key);
  const entry = record.uploads[key];
  if (!entry || !existsSync(file)) return null;
  return entry.sha256 === sha256(await readFile(file)) ? entry.url : null;
};

// ---------------------------------------------------------------------------------------------------------------
// The boards

const shotName = (b) => `${b.page}-${b.width}${b.state ? `-${b.state}` : ''}`;
const fileOf = (b, shot = false) => {
  const first = ROWS[0].boards[0];
  if (!shot && b === first) return 'Main.dc.html';
  return `${shotName(b)}${shot ? '-shot' : ''}.dc.html`;
};
const titleOf = (b) => `${b.name}, ${b.width}`;
const boards = ROWS.flatMap((row) => row.boards.map((b) => ({ ...b, row: row.id })));
for (const row of ROWS) row.boards = boards.filter((b) => b.row === row.id);

async function measure() {
  for (const b of boards) {
    const shot = join(SHOTS, `${shotName(b)}.png`);
    if (!existsSync(shot)) throw new Error(`${relative(ROOT, shot)} is missing: npm run shoot -- ${b.page}${b.state ? ` --state ${b.state}` : ''}`);
    const { width, height } = await sharp(shot).metadata();
    if (width !== b.width) throw new Error(`${relative(ROOT, shot)} is ${width} wide, not ${b.width}`);
    b.shot = shot;
    b.pageHeight = height;                                   // the page's height at its width, or the window's
    b.h = Math.min(height, MAX_FRAME);                       // the live frame
    b.cut = height > MAX_FRAME;
    b.scale = height > MAX_FRAME ? MAX_FRAME / height : 1;   // the screenshot's frame
    b.sw = Math.round(b.width * b.scale);
    b.sh = Math.min(height, MAX_FRAME);
  }
}

// ---------------------------------------------------------------------------------------------------------------
// A built page, serialized in the browser after its scripts have run, as an artboard's markup: every element
// closed, every attribute quoted, no script, and every asset named by a token the uploads replace.

function serialize({ state }) {
  const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
  const DROP = new Set(['script', 'noscript', 'template', 'iframe', 'frame', 'frameset', 'object', 'embed', 'portal',
    'applet', 'link', 'meta', 'style', 'base']);
  // Whitespace between these is never drawn; the canvas would put a stray text node there.
  const TIGHT = new Set(['table', 'thead', 'tbody', 'tfoot', 'tr', 'colgroup', 'select', 'optgroup', 'datalist', 'svg', 'g', 'defs']);
  const RAW = new Set(['pre', 'textarea', 'listing']);
  const text = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\u00a0/g, '&nbsp;');
  const quote = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const problems = [];
  const refs = new Set();
  const pictures = [];

  const header = document.querySelector('.kn-header');
  let modal = null;
  let focus = null;
  if (state === 'menu') modal = document.querySelector('.kn-header .kn-megamenu');
  if (state === 'search') {
    modal = document.querySelector('.kn-header .kn-header-search-overlay');
    focus = modal?.querySelector('input[type=search]');
  }
  if (state && !modal) problems.push(`the header has no ${state} panel`);

  const out = [];
  const walk = (node, raw, parent) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const value = node.nodeValue ?? '';
      if (!value) return;
      if (value.includes('{{') || value.includes('}}')) problems.push(`text the canvas would read as a hole: ${value.slice(0, 60)}`);
      if (/^\s+$/.test(value) && /\u00a0/.test(value)) problems.push('a text node of no-break spaces alone, which the canvas drops');
      if (!/[^ \t\n\r\f]/.test(value) && !raw) {
        if (!TIGHT.has(parent)) out.push(' ');
        return;
      }
      out.push(text(value));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = node.localName;
    if (DROP.has(tag.toLowerCase())) return;
    const attrs = [];
    for (const { name, value } of node.attributes) {
      if (name === 'autofocus' || /^on/i.test(name) || (name === 'style' && !value.trim())) continue;
      if (value.includes('{{') || value.includes('}}')) problems.push(`attribute the canvas would read as a hole: ${name}`);
      if (name === 'src' && (tag === 'img' || tag === 'source')) {
        refs.add(value);
        attrs.push([name, `@@asset:${value}@@`]);
      } else if (name === 'srcset') {
        problems.push(`srcset on <${tag}>`);
      } else if (name === 'style' && /url\(/i.test(value)) {
        attrs.push(['data-ab-picture', String(pictures.length)]);
        pictures.push(value);
      } else attrs.push([name, value]);
    }
    if (node.matches('body > .kn-page') && !node.hasAttribute('data-kn-mode')) attrs.push(['data-kn-mode', 'light']);
    if (node === modal) {
      if (!node.hasAttribute('open')) attrs.push(['open', '']);
      attrs.push(['data-ab-modal', '']);
    }
    if (node === focus) attrs.push(['data-ab-focus', '']);
    out.push(`<${tag}${attrs.map(([name, value]) => ` ${name}="${quote(value)}"`).join('')}>`);
    if (VOID.has(tag) && node.namespaceURI === 'http://www.w3.org/1999/xhtml') return;
    const inRaw = raw || RAW.has(tag);
    // The parser drops a newline right after <pre>: write one more where the text begins with one.
    if (RAW.has(tag) && node.firstChild?.nodeType === Node.TEXT_NODE && node.firstChild.nodeValue.startsWith('\n')) out.push('\n');
    for (const child of node.childNodes) walk(child, inRaw, tag);
    out.push(`</${tag}>`);
  };
  for (const child of document.body.childNodes) walk(child, false, 'body');
  return { html: out.join('').trim(), refs: [...refs], pictures, problems, step: header?.dataset.knStep ?? null };
}

async function convertPages(browser) {
  const done = new Map();
  for (const b of boards) {
    const key = `${b.page}|${b.width}|${b.state ?? ''}`;
    if (done.has(key)) { b.markup = done.get(key); continue; }
    const file = join(DIST, `${b.page}.html`);
    if (!existsSync(file)) throw new Error(`${relative(ROOT, file)} is not built: npm run build -- ${b.page}`);
    const tab = await browser.newPage({ viewport: { width: b.width, height: WINDOW[b.width] }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    await tab.waitForTimeout(100);
    const markup = await tab.evaluate(serialize, { state: b.state ?? null });
    await tab.close();
    if (markup.problems.length) throw new Error(`${b.page} at ${b.width}: ${markup.problems.join('; ')}`);
    done.set(key, markup);
    b.markup = markup;
  }
}

// ---------------------------------------------------------------------------------------------------------------
// The uploads: one size of each picture, the largest any board uses; the logos and drawings without what an
// uploaded SVG may not hold; the fonts; the stylesheets; and the screenshots.

const pictureRef = (ref) => {
  const path = ref.replace(/^\.\//, '');
  let m = path.match(/^images\/(.+)-(\d+)\.(jpe?g|png|webp)$/);
  if (m) return { key: `images/${m[1]}.${m[3]}`, id: m[1], width: Number(m[2]), ext: m[3] };
  m = path.match(/^(images|logos|logo)\/([^/]+\.svg)$/);
  if (m) return { key: `${m[1]}/${m[2]}`, source: join(DIST, m[1], m[2]), svg: true };
  throw new Error(`an asset the script does not know how to carry: ${ref}`);
};

// An uploaded SVG holds no <style>, animation, foreignObject or picture: a style of simple rules becomes
// presentation attributes, in light mode, and comments go.
function cleanSvg(source, name) {
  let svg = source.replace(/<!--[\s\S]*?-->/g, '');
  const style = svg.match(/<style[^>]*>([\s\S]*?)<\/style>/);
  if (style) {
    svg = svg.replace(style[0], '');
    const css = style[1].replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, '');
    for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      const props = body.split(';').map((d) => d.split(':')).filter(([k, v]) => k?.trim() && v?.trim())
        .map(([k, ...v]) => [k.trim(), v.join(':').trim().replace(/"/g, '&quot;')]);
      const add = (tag) => {
        const present = new Set([...tag.matchAll(/\s([\w:-]+)=/g)].map((m) => m[1]));
        const extra = props.filter(([k]) => !present.has(k)).map(([k, v]) => ` ${k}="${v}"`).join('');
        return tag.replace(/(\s*\/?>)$/, `${extra}$1`);
      };
      const sel = selector.trim();
      if (sel === '*') svg = svg.replace(/<svg\b[^>]*>/, add);
      else if (/^\.[\w-]+$/.test(sel)) {
        const cls = sel.slice(1);
        svg = svg.replace(/<[a-zA-Z][^>]*\bclass="([^"]*)"[^>]*>/g, (tag, list) => (list.split(/\s+/).includes(cls) ? add(tag) : tag));
      } else throw new Error(`${name}: a style rule the script cannot turn into attributes: ${sel}`);
    }
  }
  if (/<style|<foreignObject|<image\b|<animate|<set\b|<script/i.test(svg)) throw new Error(`${name} holds what an uploaded SVG may not`);
  return svg.replace(/\n{2,}/g, '\n');
}

// --------------------------------------------------------------------------------------------------------------
// The stylesheets. kn.css is the pages' own but for its @font-face rules, which each artboard's helmet holds with
// the fonts at their uploads. canvas-patch.css, loaded after it, makes the pages render on the canvas as in a
// browser window:
//
// - A frame is a window as tall as its page, so a length in vh, svh or dvh is 1/100 of the page, not of a window.
//   Each rule that holds one is repeated, in its place in the cascade, with the unit as var(--ab-vh), which an
//   artboard sets to 1/100 of the window shoot.mjs shot in.
// - A dialog the header opens is shown modal in a browser, and the search box's field has the focus. An artboard
//   cannot open one or focus the other, so each rule for :modal and :focus-visible is repeated for the attributes
//   an artboard of an open menu or search box carries (data-ab-modal, data-ab-focus), and the last rules
//   give such a dialog what the top layer gives it: its place below the header bar, above the page, and a backdrop.

function parseCss(css) {
  let i = 0;
  const n = css.length;
  const DECLS = new Set(['font-face', 'page', 'property', 'counter-style', 'font-feature-values', 'font-palette-values', 'view-transition', 'position-try']);
  const skipString = () => { const q = css[i++]; while (i < n && css[i] !== q) i += css[i] === '\\' ? 2 : 1; i++; };
  const skipSpace = () => {
    while (i < n) {
      if (/\s/.test(css[i])) i++;
      else if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; }
      else break;
    }
  };
  const readUntil = (stops) => {
    const start = i;
    let depth = 0;
    while (i < n) {
      const c = css[i];
      if (c === '"' || c === "'") { skipString(); continue; }
      if (css.startsWith('/*', i)) { const e = css.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;
      else if (depth === 0 && stops.includes(c)) break;
      i++;
    }
    return css.slice(start, i);
  };
  const list = () => {
    const nodes = [];
    for (;;) {
      skipSpace();
      if (i >= n) return nodes;
      if (css[i] === '}') { i++; return nodes; }
      if (css[i] === '@') {
        const prelude = readUntil(['{', ';', '}']).trim();
        if (css[i] !== '{') { if (css[i] === ';') i++; nodes.push({ type: 'statement', prelude }); continue; }
        i++;
        const name = prelude.slice(1).match(/^[\w-]+/)[0].toLowerCase();
        if (DECLS.has(name)) { const body = readUntil(['}']); i++; nodes.push({ type: 'at', prelude, body }); }
        else nodes.push({ type: 'at', prelude, name, nodes: list() });
      } else {
        const selector = readUntil(['{', '}']).trim();
        if (css[i] !== '{') throw new Error(`CSS: a selector with no block near ${i}`);
        i++;
        const body = readUntil(['{', '}']);
        if (css[i] === '{') throw new Error(`CSS: a nested rule in ${selector.slice(0, 80)}`);
        i++;
        nodes.push({ type: 'rule', selector, body });
      }
    }
  };
  return list();
}

const splitDecls = (body) => {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'") { const q = c; i++; while (i < body.length && body[i] !== q) i += body[i] === '\\' ? 2 : 1; continue; }
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ';' && depth === 0) { out.push(body.slice(start, i)); start = i + 1; }
  }
  out.push(body.slice(start));
  return out.map((d) => d.trim()).filter(Boolean);
};
const VH = /(?<![\w.#-])(-?(?:\d+\.?\d*|\.\d+))(dvh|svh|lvh|vh)\b/g;
const windowed = (decl) => decl.replace(VH, (_, number, unit) => `calc(${number} * var(--ab-vh, 1${unit}))`);
const staged = (selector) => selector
  .replace(/:focus-visible\b/g, ':is(:focus-visible,[data-ab-focus])')
  .replace(/:modal\b/g, ':is(:modal,[data-ab-modal])');

function patchCss(css) {
  const out = [];
  const visit = (nodes, chain) => {
    for (const node of nodes) {
      if (node.type === 'at' && node.nodes) {
        if (/keyframes$/.test(node.name)) continue;
        visit(node.nodes, [...chain, node.prelude]);
      } else if (node.type === 'rule') {
        const selector = staged(node.selector);
        const decls = splitDecls(node.body);
        const kept = selector !== node.selector ? decls.map(windowed) : decls.filter((d) => windowed(d) !== d).map(windowed);
        if (!kept.length) continue;
        out.push(chain.map((p) => `${p}{`).join('') + `${selector}{${kept.join(';')}}` + '}'.repeat(chain.length));
      }
    }
  };
  visit(parseCss(css), []);
  out.push(`/* What the top layer gives a dialog shown modal, for an artboard that shows one open. */
.kn-header .kn-header-panel[data-ab-modal]{position:fixed;inset-block-start:var(--ab-panel-top,0px);z-index:2147483000}
.kn-header .kn-header-search-overlay[data-ab-modal]::after{content:"";position:fixed;inset:0;z-index:-2;pointer-events:none;backdrop-filter:blur(.75rem)}`);
  return `${out.join('\n')}\n`;
}

// ---------------------------------------------------------------------------------------------------------------
// The artboards

const escapeJson = (value) => JSON.stringify(value).replace(/&/g, '&amp;').replace(/'/g, '&#39;');
const logic = 'class Component extends DCLogic {\n  renderVals() {\n    return {};\n  }\n}';

function liveBoard(b, urls) {
  const { html, pictures } = b.markup;
  const body = html.replace(/@@asset:([^@]+)@@/g, (_, ref) => urls.asset(ref));
  const rules = pictures.map((style, n) => `[data-ab-picture="${n}"]{${style.replace(/url\((['"]?)([^'")]+)\1\)/g, (_, q, ref) => `url('${urls.asset(ref)}')`)}}`);
  const vh = WINDOW[b.width] / 100;
  const panelTop = b.state ? `--ab-panel-top:${b.panelTop}px;` : '';
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${titleOf(b)}</title>
<script src="./support.js"></script>
${urls.styles.map((href) => `<link rel="stylesheet" href="${href}">`).join('\n')}
</head>
<body>
<x-dc>
<helmet>
<style>
${urls.fontFaces.join('\n')}
:root{--ab-vh:${vh}px;${panelTop}}
html{scrollbar-width:none}
body{margin:0}
${rules.join('\n')}
</style>
</helmet>
${body}
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${escapeJson({ $preview: { width: b.width, height: b.h } })}'>
${logic}
</script>
</body>
</html>
`;
}

function shotBoard(b, url) {
  const label = `${titleOf(b)}, screenshot`;
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<title>${label}</title>
<script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0}
</style>
</helmet>
<div style="width: ${b.sw}px; height: ${b.sh}px; background: #ffffff">
<img src="${url}" alt="${label}" style="display: block; width: ${b.sw}px; height: ${b.sh}px">
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='${escapeJson({ $preview: { width: b.sw, height: b.sh } })}'>
${logic}
</script>
</body>
</html>
`;
}

function layout(existing) {
  const index = existing ? structuredClone(existing) : {};
  const owned = new Set(boards.flatMap((b) => [fileOf(b), fileOf(b, true)]));
  const ownedNotes = (id) => /^(row-|note-)/.test(id);
  const boardsOut = {};
  const notes = {};
  let y = 0;
  for (const row of ROWS) {
    const height = Math.max(...row.boards.map((b) => b.h));
    let x = 0;
    let xs = 0;
    for (const b of row.boards) {
      const prior = index.boards?.[fileOf(b)] ?? {};
      boardsOut[fileOf(b)] = { ...prior, x, y, w: b.width, h: b.h, title: titleOf(b), page: 'design', ...(b.state ? {} : { expand: 'fill' }) };
      if (b.state) delete boardsOut[fileOf(b)].expand;
      const priorShot = index.boards?.[fileOf(b, true)] ?? {};
      const shotTitle = b.scale < 1 ? `${titleOf(b)} (at ${Math.round(b.scale * 100)} %)` : titleOf(b);
      boardsOut[fileOf(b, true)] = { ...priorShot, x: xs, y, w: b.sw, h: b.sh, title: shotTitle, page: 'screenshots' };
      x += b.width + GAP;
      xs += b.sw + GAP;
    }
    for (const page of PAGES) {
      notes[`row-${row.id}-${page.id}`] = { x: 0, y: y - TITLE_ABOVE, text: row.title, kind: 'title1', maxW: (page.id === 'design' ? x : xs) - GAP, page: page.id };
    }
    y += height + ROW_GAP;
  }
  notes['note-about'] = { x: -720, y: 0, w: 560, text: NOTE, page: 'design' };
  const otherBoards = Object.fromEntries(Object.entries(index.boards ?? {}).filter(([file]) => !owned.has(file)));
  const otherNotes = Object.fromEntries(Object.entries(index.notes ?? {}).filter(([id]) => !ownedNotes(id)));
  const allBoards = { ...boardsOut, ...otherBoards };
  const order = [...Object.keys(boardsOut), ...(index.order ?? []).filter((file) => otherBoards[file])];
  return {
    ...index,
    v: 3,
    createdOnFiles: index.createdOnFiles ?? record.createdOnFiles,
    title: index.title ?? TITLE,
    launch: { view: 'canvas', page: 'design' },
    pages: PAGES,
    boards: allBoards,
    order,
    notes: { ...otherNotes, ...notes },
    designSystems: index.designSystems ?? record.designSystems ?? [],
  };
}

// ---------------------------------------------------------------------------------------------------------------
// The checks: each rule of the artboard format that fails silently and that a script can state.

const VOIDS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const FORBIDDEN = new Set(['script', 'iframe', 'object', 'embed', 'frame', 'frameset', 'portal', 'applet', 'template', 'meta', 'base', 'link']);

function checkMarkup(markup, where) {
  const problems = [];
  const stack = [];
  const tagRe = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w:-]*)((?:\s+[^\s"'>\/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)\s*(\/?)>/y;
  let i = 0;
  let inHelmet = false;
  while (i < markup.length) {
    const lt = markup.indexOf('<', i);
    if (lt < 0) break;
    tagRe.lastIndex = lt;
    const m = tagRe.exec(markup);
    if (!m) { problems.push(`${where}: a "<" that starts no well-formed tag: ${markup.slice(lt, lt + 60)}`); i = lt + 1; continue; }
    i = tagRe.lastIndex;
    if (m[0].startsWith('<!--')) continue;
    const [, closing, rawName, attrText, selfClose] = m;
    const name = rawName.toLowerCase();
    if (closing) {
      const open = stack.pop();
      if (open !== name) { problems.push(`${where}: </${name}> closes <${open ?? 'nothing'}>`); if (open) stack.push(open); }
      if (name === 'helmet') inHelmet = false;
      continue;
    }
    if (name === 'helmet') inHelmet = true;
    if (FORBIDDEN.has(name)) problems.push(`${where}: <${name}> is not allowed in an artboard's body`);
    if (name === 'style' && !inHelmet) problems.push(`${where}: <style> outside <helmet>`);
    for (const a of attrText.matchAll(/\s+([^\s"'>\/=]+)(?:\s*=\s*("[^"]*"|'[^']*'|[^\s"'=<>`]+))?/g)) {
      const [, attr, value] = a;
      if (value === undefined || !value.startsWith('"')) problems.push(`${where}: <${name} ${attr}> is not quoted with "`);
      if (/^on/i.test(attr)) problems.push(`${where}: an event attribute ${attr}`);
      const v = value?.slice(1, -1) ?? '';
      if (attr === 'style' && /url\(/i.test(v)) problems.push(`${where}: url() in an inline style`);
      if (['src', 'poster', 'srcset', 'data'].includes(attr) && !/^\/_blob\/[\w-]+$/.test(v)) problems.push(`${where}: <${name} ${attr}="${v.slice(0, 60)}"> is no upload`);
      if (/^\s*data:/i.test(v) && ['href', 'src', 'action', 'poster', 'data', 'style'].includes(attr)) problems.push(`${where}: a data: address in ${attr}`);
    }
    if (selfClose) problems.push(`${where}: <${name}/> is self-closed`);
    else if (!VOIDS.has(name)) stack.push(name);
  }
  if (stack.length) problems.push(`${where}: left open: ${stack.join(' > ')}`);
  return problems;
}

async function check() {
  const problems = [];
  const index = JSON.parse(await readFile(join(PROJECT, 'canvas.json'), 'utf8'));
  const files = (await readdir(PROJECT)).filter((f) => f.endsWith('.dc.html'));
  const me = userInfo().username;
  const home = homedir();
  for (const file of files) {
    const where = file;
    const text = await readFile(join(PROJECT, file), 'utf8');
    const entry = index.boards[file];
    if (!entry) problems.push(`${where}: no entry in canvas.json`);
    if (!/^[A-Za-z0-9_][A-Za-z0-9_.-]*\.dc\.html$/.test(file)) problems.push(`${where}: a file name the canvas does not take`);
    if (!text.startsWith('<!doctype html>\n<html lang="')) problems.push(`${where}: no doctype and <html lang>`);
    const head = text.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? '';
    const headLines = head.trim().split('\n');
    const support = headLines.indexOf('<script src="./support.js"></script>');
    if (support < 0) problems.push(`${where}: the head line <script src="./support.js"></script> is missing`);
    headLines.forEach((line, n) => {
      if (/^<link /.test(line)) {
        if (n < support) problems.push(`${where}: a <link> before the support.js line`);
        if (!/^<link rel="stylesheet" href="(\/_blob\/[\w-]+|(\.\.\/)*ds\/[a-z0-9][a-z0-9_-]*\/[\w./-]+)">$/.test(line)) problems.push(`${where}: a head link that is no upload or design-system copy: ${line}`);
      } else if (/^<script/.test(line) && line !== '<script src="./support.js"></script>') problems.push(`${where}: a script of the page's own in the head`);
    });
    const dc = text.match(/<body>\n<x-dc>\n([\s\S]*)\n<\/x-dc>\n<script type="text\/x-dc" data-dc-script data-props='([^']*)'>\n([\s\S]*?)\n<\/script>\n<\/body>\n<\/html>\n$/);
    if (!dc) { problems.push(`${where}: the body is not <x-dc> followed by the data-dc-script block`); continue; }
    const [, markup, props, js] = dc;
    if ((text.match(/<script/g) ?? []).length !== 2) problems.push(`${where}: a script beyond support.js and the data-dc-script block`);
    if (!/^class Component extends DCLogic \{/.test(js) || /\bimport\b|\bexport\b|innerHTML|appendChild|window\./.test(js)) problems.push(`${where}: the logic is not a plain DCLogic class`);
    let preview;
    try { preview = JSON.parse(props.replace(/&#39;/g, "'").replace(/&amp;/g, '&')).$preview; } catch { problems.push(`${where}: data-props is not JSON`); }
    if (entry && (preview?.width !== entry.w || preview?.height !== entry.h)) problems.push(`${where}: $preview ${preview?.width}x${preview?.height} is not the frame ${entry.w}x${entry.h}`);
    if (!markup.startsWith('<helmet>\n<style>\n') || !/^<helmet>\n<style>\n[^<]*\n<\/style>\n<\/helmet>\n/.test(markup)) problems.push(`${where}: <helmet> does not hold one <style> first`);
    if (/\{\{|\}\}/.test(markup.replace(/^<helmet>[\s\S]*?<\/helmet>/, ''))) problems.push(`${where}: "{{" or "}}" the canvas would read as a hole`);
    for (const m of markup.matchAll(/url\((['"]?)([^'")]*)\1\)/g)) if (!/^\/_blob\/[\w-]+$/.test(m[2])) problems.push(`${where}: url(${m[2]}) is no upload`);
    for (const word of [home, me, '/Users/', '/private/', '/tmp/', 'file:', 'localhost', '127.0.0.1']) {
      if (word && text.includes(word)) problems.push(`${where}: names this machine (${word === me ? 'the user name' : word})`);
    }
    problems.push(...checkMarkup(markup, where));
  }
  for (const [file, entry] of Object.entries(index.boards)) {
    // A board another hand added is kept from the canvas (--index) and is not written here.
    if (!files.includes(file) && !(indexArg && !boards.some((b) => [fileOf(b), fileOf(b, true)].includes(file)))) problems.push(`canvas.json names ${file}, which is not written`);
    for (const k of ['x', 'y', 'w', 'h']) if (typeof entry[k] !== 'number') problems.push(`canvas.json: ${file} has no ${k}`);
    if (entry.w < 40 || entry.w > MAX_FRAME || entry.h < 40 || entry.h > MAX_FRAME) problems.push(`canvas.json: ${file} is ${entry.w}x${entry.h}`);
    if (entry.page && !index.pages.some((p) => p.id === entry.page)) problems.push(`canvas.json: ${file} is on no listed page`);
  }
  const keys = Object.keys(index.boards);
  if (keys.length !== index.order.length || !keys.every((k) => index.order.includes(k))) problems.push('canvas.json: order does not hold each board once');
  if (index.order[0] !== 'Main.dc.html') problems.push('canvas.json: the first board is not Main.dc.html');
  for (const id of [...Object.keys(index.notes), ...index.pages.map((p) => p.id)]) if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) problems.push(`canvas.json: the id ${id}`);
  if (JSON.stringify(index).includes(home) || JSON.stringify(index).includes(me)) problems.push('canvas.json names this machine');
  return problems;
}

// ---------------------------------------------------------------------------------------------------------------
// The local check: an artboard's content in a plain page of this script's own, with the same stylesheets and
// pictures from disk, in a window of the frame's size, as the canvas's runtime places it; screenshotted and
// compared with the page's screenshot. It checks the conversion, not the canvas.

async function preview(names) {
  const byUrl = new Map(Object.entries(record.uploads).map(([key, { url }]) => [url, pathToFileURL(join(UPLOAD, key)).href]));
  const keyOf = new Map(Object.entries(record.uploads).map(([key, { url }]) => [url, key]));
  const walkUploads = async (dir) => (await readdir(dir, { withFileTypes: true })).flatMap((e) => (e.isDirectory() ? [] : [relative(UPLOAD, join(dir, e.name))]));
  for (const sub of ['', ...(await readdir(UPLOAD, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name)]) {
    for (const key of await walkUploads(join(UPLOAD, sub))) { byUrl.set(dryUrl(key), pathToFileURL(join(UPLOAD, key)).href); keyOf.set(dryUrl(key), key); }
  }
  const local = (text) => text.replace(/\/_blob\/[\w-]+/g, (url) => byUrl.get(url) ?? url);
  const dir = join(OUT, 'preview');
  await mkdir(dir, { recursive: true });
  const chosen = names.length ? boards.filter((b) => names.includes(fileOf(b)) || names.includes(shotName(b))) : boards.filter((b) => ['home-1440', 'home-390', 'home-1440-menu', 'home-390-search', 'solutions-rooftop-solar-390', 'contact-1440'].includes(shotName(b)));
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  try {
    for (const b of chosen) {
      const text = await readFile(join(PROJECT, fileOf(b)), 'utf8');
      const links = [...text.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)].map((m) => m[1]);
      const helmet = text.match(/<helmet>\n<style>\n([\s\S]*?)\n<\/style>\n<\/helmet>/)[1];
      const content = text.match(/<\/helmet>\n([\s\S]*)\n<\/x-dc>/)[1];
      // The stylesheet as uploaded names its fonts by upload; on disk it names the font files.
      const css = [];
      for (const href of links) {
        const key = keyOf.get(href);
        css.push(local(await readFile(join(UPLOAD, key), 'utf8')));
      }
      const page = `<!doctype html>
<html lang="en-GB" data-dc-canvas="">
<head>
<meta charset="utf-8">
${css.map((c) => `<style>${c}</style>`).join('\n')}
<style>${local(helmet)}</style>
<style>html,body{background:#ededeb}#dc-root>.sc-host{position:relative}</style>
</head>
<body><div id="dc-root"><div class="sc-host">${local(content)}</div></div></body>
</html>
`;
      const file = join(dir, `${shotName(b)}.html`);
      await writeFile(file, page);
      const tab = await browser.newPage({ viewport: { width: b.width, height: b.h }, deviceScaleFactor: 1 });
      await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });
      await tab.evaluate(() => document.fonts.ready);
      await tab.waitForTimeout(400);
      const png = join(dir, `${shotName(b)}.png`);
      await tab.screenshot({ path: png });
      const contentHeight = await tab.evaluate(() => document.documentElement.scrollHeight);
      await tab.close();
      // The difference with the shot, as the share of pixels that differ, and a picture of where.
      const h = Math.min(b.h, b.pageHeight);
      const [mine, theirs] = await Promise.all([png, b.shot].map((f) => sharp(f).extract({ left: 0, top: 0, width: b.width, height: h }).removeAlpha().raw().toBuffer()));
      const diff = Buffer.alloc(mine.length);
      let differ = 0;
      for (let p = 0; p < mine.length; p += 3) {
        const d = Math.abs(mine[p] - theirs[p]) + Math.abs(mine[p + 1] - theirs[p + 1]) + Math.abs(mine[p + 2] - theirs[p + 2]);
        if (d > 24) { differ++; diff[p] = 255; diff[p + 1] = 0; diff[p + 2] = 0; } else { diff[p] = diff[p + 1] = diff[p + 2] = Math.round(mine[p] * 0.3 + 178); }
      }
      await sharp(diff, { raw: { width: b.width, height: h, channels: 3 } }).png().toFile(join(dir, `${shotName(b)}-diff.png`));
      console.log(`${fileOf(b).padEnd(64)} content ${contentHeight} px, page ${b.pageHeight} px, ${(differ / (mine.length / 3) * 100).toFixed(2)} % of pixels differ`);
    }
  } finally {
    await browser.close();
  }
}

// ---------------------------------------------------------------------------------------------------------------

async function main() {
  if (command === 'record') {
    if (args.length % 2) { console.error('record takes pairs: <file> <url>'); process.exit(2); }
    for (let n = 0; n < args.length; n += 2) {
      const key = relative(UPLOAD, resolve(UPLOAD, args[n])).split('\\').join('/');
      const url = args[n + 1];
      if (!/^\/_blob\/[\w-]+$/.test(url)) throw new Error(`not an upload's address: ${url}`);
      const file = join(UPLOAD, key);
      if (!existsSync(file)) throw new Error(`no such file to record: ${file}`);
      record.uploads[key] = { sha256: sha256(await readFile(file)), url };
      console.log(`${key} = ${url}`);
    }
    await saveRecord();
    return;
  }
  await measure();
  if (command === 'check') {
    const problems = await check();
    problems.forEach((p) => console.error(p));
    console.log(problems.length ? `${problems.length} problems` : 'The canvas files keep every rule checked.');
    process.exit(problems.length ? 1 : 0);
  }
  if (command === 'preview') return preview(args);

  // Convert.
  const browser = await chromium.launch({ args: ['--allow-file-access-from-files'] });
  try {
    await convertPages(browser);
    // Where an open panel sits: below the header bar, as the top layer places it.
    for (const b of boards.filter((x) => x.state)) {
      const tab = await browser.newPage({ viewport: { width: b.width, height: WINDOW[b.width] }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      await tab.goto(pathToFileURL(join(DIST, `${b.page}.html`)).href, { waitUntil: 'load' });
      b.panelTop = await tab.evaluate((which) => {
        const dialog = document.querySelector(which === 'menu' ? '.kn-header .kn-megamenu' : '.kn-header .kn-header-search-overlay');
        dialog.showModal();
        return Math.round(dialog.getBoundingClientRect().top * 100) / 100;
      }, b.state);
      await tab.close();
    }
  } finally {
    await browser.close();
  }

  // What to upload, at <out>/upload/<key>.
  await mkdir(UPLOAD, { recursive: true });
  const pictures = new Map();
  for (const b of boards) {
    for (const ref of [...b.markup.refs, ...b.markup.pictures.flatMap((s) => [...s.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]))]) {
      const p = pictureRef(ref);
      const known = pictures.get(p.key);
      if (!known || (p.width ?? 0) > (known.width ?? 0)) pictures.set(p.key, p);
    }
  }
  const writeUpload = async (key, data) => { await mkdir(dirname(join(UPLOAD, key)), { recursive: true }); await writeFile(join(UPLOAD, key), data); };
  for (const p of pictures.values()) {
    if (p.svg) await writeUpload(p.key, cleanSvg(await readFile(p.source, 'utf8'), p.key));
    else {
      await mkdir(join(UPLOAD, 'images'), { recursive: true });
      await copyFile(join(DIST, 'images', `${p.id}-${p.width}.${p.ext}`), join(UPLOAD, p.key));
    }
  }
  // The fonts' @font-face rules go to each artboard's helmet, with the fonts at their uploads; kn.css is the rest.
  const pageCss = (await readFile(join(DIST, `${boards[0].page}.html`), 'utf8')).match(/<style[^>]*>([\s\S]*?)<\/style>/)[1];
  const fontFaces = pageCss.match(/@font-face\{[^}]*\}/g) ?? [];
  const fonts = new Map(fontFaces.flatMap((rule) => [...rule.matchAll(/url\((['"]?)(_astro\/([^'")]+?)\.[\w-]+\.(woff2?|ttf|otf))\1\)/g)].map((m) => [m[2], `fonts/${m[3]}.${m[4]}`])));
  for (const [source, key] of fonts) await writeUpload(key, await readFile(join(DIST, source)));
  const knCss = fontFaces.reduce((css, rule) => css.replace(rule, ''), pageCss);
  if (/url\((['"]?)_astro\//.test(knCss)) throw new Error('the stylesheet names a file of _astro/ outside @font-face');
  await writeUpload('styles/kn.css', knCss);
  for (const b of boards) {
    let image = sharp(b.shot);
    if (b.scale < 1) image = image.resize(b.sw, b.sh, { kernel: 'lanczos3' });
    const [lossy, lossless] = await Promise.all([
      image.clone().webp({ quality: 92, smartSubsample: true, effort: 5 }).toBuffer(),
      image.clone().webp({ lossless: true, effort: 5 }).toBuffer(),
    ]);
    await writeUpload(`shots/${shotName(b)}.webp`, lossless.length <= lossy.length * 1.25 ? lossless : lossy);
  }
  await writeUpload('styles/canvas-patch.css', patchCss(pageCss));

  const pending = [];
  const urlOf = async (key) => { const url = await uploaded(key); if (!url) pending.push(key); return url; };
  const fontUrls = new Map();
  for (const [source, key] of fonts) fontUrls.set(source, await urlOf(key));
  const assetUrls = new Map();
  for (const p of pictures.values()) assetUrls.set(p.key, await urlOf(p.key));
  const shotUrls = new Map();
  for (const b of boards) shotUrls.set(b, await urlOf(`shots/${shotName(b)}.webp`));
  const patchUrl = await urlOf('styles/canvas-patch.css');
  const cssUrl = await urlOf('styles/kn.css');

  if (pending.length) {
    console.log(`Upload these to ${record.canvas ?? 'the canvas'} (publish with asset: true, up to 25 a call), then record each: node scripts/to-canvas.mjs record --out ${outArg} <file> <url> …`);
    for (const key of pending) console.log(join(UPLOAD, key));
    process.exit(3);
  }

  // The canvas.
  const urls = {
    styles: [cssUrl, patchUrl],
    fontFaces: fontFaces.map((rule) => rule.replace(/url\((['"]?)(_astro\/[^'")]+)\1\)/g, (_, q, source) => `url('${fontUrls.get(source)}')`)),
    asset: (ref) => assetUrls.get(pictureRef(ref).key),
  };
  if (!record.createdOnFiles) { record.createdOnFiles = { v: 1, at: new Date().toISOString().replace(/\.\d+Z$/, 'Z') }; if (!dry) await saveRecord(); }
  await rm(PROJECT, { recursive: true, force: true });
  await mkdir(PROJECT, { recursive: true });
  const existing = indexArg ? JSON.parse(await readFile(resolve(indexArg), 'utf8')) : null;
  await writeFile(join(PROJECT, 'canvas.json'), `${JSON.stringify(layout(existing), null, 1)}\n`);
  for (const b of boards) {
    await writeFile(join(PROJECT, fileOf(b)), liveBoard(b, urls));
    await writeFile(join(PROJECT, fileOf(b, true)), shotBoard(b, shotUrls.get(b)));
  }
  const problems = await check();
  problems.forEach((p) => console.error(p));
  if (problems.length) { console.error(`${problems.length} problems: nothing to publish`); process.exit(1); }
  if (dry) console.log('A dry run: the addresses are made up, for preview only. Do not publish it.');
  console.log(`Written: ${OUT} (the root to publish from), project/canvas.json and ${boards.length * 2} artboards. Publish project/canvas.json and project/Main.dc.html first, then the rest.`);
  for (const b of boards.filter((x) => x.cut)) console.log(`cut by the frame's height: ${titleOf(b)} is ${b.pageHeight} px tall`);
}

await main();
