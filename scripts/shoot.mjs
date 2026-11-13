#!/usr/bin/env node
// Screenshots of the built site, as the mockups shoot theirs (design/mockups/scripts/shoot.mjs), so that a page can be
// put beside its mockup: the same page names, widths and states, in light mode. It serves dist/ over HTTP itself, as
// the site's pages name their files by addresses from the root, and builds nothing: run `npm run build` first.
//
//   npm run shoot -- <page> [<page> …]       shots/<page>-1440.png and shots/<page>-390.png, the whole page
//   npm run shoot -- --all                   every page built
//   npm run shoot -- <page> --state <state>  the window alone, in a state of the frame:
//       menu      the header's menu open
//       search    the header's search box open
//       scrolled  scrolled down by the wheel and a little back up, the header come back over the content
//       down      scrolled down by the wheel, the header slid away (the mockups have no such shot)
//       end       scrolled down by the wheel to the very end, the footer revealed
//       ending    likewise, but half the footer's height short of the end, the page leaving the footer
//   --widths 1024,768   other widths
//   --banner            with the consent banner, which is otherwise answered once, "Reject optional", before the shots
//   --compare           also each shot beside the mockup's of the same name, design/mockups/shots/<name>.png, in
//                       shots/compare/, with the parts of a tall pair, about 2,000 px each, beside it
//   --firefox [path]    in the installed Firefox, not Playwright's Chromium, driven by puppeteer-core over WebDriver
//                       BiDi as Konzilo Design's docs/spec/header.md says, into shots/firefox/; with no path, the
//                       FIREFOX environment variable, else /Applications/Firefox.app/Contents/MacOS/firefox. Motion
//                       is not reduced there, as in the browser a visitor uses
//   --dist <folder>, --out <folder>   read and write elsewhere
//
// A page's name is its address with the slashes as hyphens, as the mockups name theirs: / is `home`,
// /solutions/rooftop-solar/ is `solutions-rooftop-solar`; `not-found` is the 404 page. An address, such as
// /insights/page/2/ or /search/?q=battery, may be given in a name's place; the shot takes the address's name without
// its query. Each shot prints what the frame was doing, read from computed style: whether the header's bar is in the
// window and casts its shadow, whether the page casts its shadow on the footer, and whether the footer fits to be
// revealed.
//
// The search page's results come from the core's search service, which runs in the image and not here. The shots'
// server answers its route, /_konzilo/search, in its stead, from the core's own search documents of content/
// (searchDocuments() of @kntnt/konzilo/search): a document whose title, terms, excerpt or body holds a word that starts
// with the query's, ranked by the weights the core gives Typesense (searchParameters()), then how often its body holds
// it, ten a page, with the body's words round the first match as the snippet. It stands in for Typesense's ranking,
// so a shot of results shows how the page looks, not what the search finds.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { searchDocuments, searchParameters } from '@kntnt/konzilo/search';
import sharp from 'sharp';
import { filesIn } from './lib/files.mjs';
import { coreModule, ROOT } from './lib/intake.mjs';

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    all: { type: 'boolean' }, state: { type: 'string', default: 'closed' }, widths: { type: 'string', default: '1440,390' },
    banner: { type: 'boolean' }, compare: { type: 'boolean' }, firefox: { type: 'boolean' },
    dist: { type: 'string' }, out: { type: 'string' },
  },
});
const STATES = ['closed', 'menu', 'search', 'scrolled', 'down', 'end', 'ending'];
const fail = (message) => {
  console.error(`shoot: ${message}`);
  process.exit(2);
};
if (!STATES.includes(values.state)) fail(`--state is one of ${STATES.join(', ')}`);
const dist = resolve(values.dist ?? join(ROOT, 'dist'));
const firefoxPath = values.firefox ? (positionals[0]?.startsWith('/') && positionals[0].endsWith('firefox') ? positionals.shift() : process.env.FIREFOX ?? '/Applications/Firefox.app/Contents/MacOS/firefox') : null;
const out = resolve(values.out ?? join(ROOT, 'shots', ...(firefoxPath ? ['firefox'] : [])));
const mockups = join(ROOT, 'design/mockups/shots');
const widths = values.widths.split(',').map(Number);
const HEIGHTS = { 390: 844, 768: 1024, 1024: 768, 1440: 900 };
if (!existsSync(join(dist, 'index.html'))) fail(`${dist} holds no built site: run npm run build first`);

// Every page built, by its name; and the 404 page, at an address nothing holds.
const pages = new Map(filesIn(dist).filter((path) => path === 'index.html' || path.endsWith('/index.html')).map((path) => {
  const address = `/${path.slice(0, -'index.html'.length)}`;
  return [address === '/' ? 'home' : address.slice(1, -1).replaceAll('/', '-'), address];
}));
pages.set('not-found', '/no-page-is-here/');
const wanted = values.all ? [...pages.keys()] : positionals;
if (wanted.length === 0) fail('name the pages to shoot, such as: npm run shoot -- home, or every page with --all');
const shots = wanted.map((given) => {
  if (given.startsWith('/')) {
    const path = given.split('?')[0];
    return { name: path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replaceAll('/', '-'), address: given };
  }
  if (!pages.has(given)) fail(`no page is called ${given}; the pages are ${[...pages.keys()].join(', ')}`);
  return { name: given, address: pages.get(given) };
});

// dist/ over HTTP: an address that ends in / is its folder's index.html, a file is itself, and any other address the
// 404 page with its status, as the web server answers.
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.rss': 'application/rss+xml', '.webmanifest': 'application/manifest+json' };
// The search service's answer, in its stead (above): Typesense's shape, as the core's search-client.js reads it.
let documents = null;
async function searchAnswer(params) {
  if (documents === null) {
    const { readSiteDescription } = await coreModule('src/site-description.js');
    documents = searchDocuments({ site: readSiteDescription(join(ROOT, 'site-description.json')), content: resolve(ROOT, process.env.KONZILO_CONTENT ?? 'content') }).documents;
  }
  const { query_by: by, query_by_weights: weights, per_page: perPage } = searchParameters(JSON.parse(readFileSync(join(ROOT, 'site-description.json'), 'utf8')));
  const fields = by.split(',').map((field, at) => ({ field, weight: Number(weights.split(',')[at]) }));
  const word = (params.get('q') ?? '').trim().toLowerCase();
  const type = /type:=([\w-]+)/.exec(params.get('filter_by') ?? '')?.[1];
  const page = Math.max(1, Number(params.get('page')) || 1);
  const holds = (text) => word !== '' && new RegExp(`(^|[^\\p{L}\\p{N}])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'iu').test(text);
  const textOf = (value) => (Array.isArray(value) ? value.join(' ') : String(value ?? ''));
  const found = documents
    .filter((document) => !type || document.type === type)
    .map((document) => {
      const score = fields.reduce((sum, { field, weight }) => sum + (holds(textOf(document[field])) ? weight * 1000 : 0), 0);
      const count = (textOf(document.body).toLowerCase().match(new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) ?? []).length;
      return { document, score: score + count };
    })
    .filter(({ score }) => score >= 1000)
    .sort((a, b) => b.score - a.score || a.document.title.localeCompare(b.document.title));
  const snippet = (body) => {
    const words = body.split(/\s+/);
    const at = words.findIndex((one) => one.toLowerCase().replace(/^[^\p{L}\p{N}]+/u, '').startsWith(word));
    if (at < 0) return undefined;
    const from = Math.max(0, at - 8);
    return words.slice(from, at + 9).map((one, index) => (from + index === at ? one.replace(/[\p{L}\p{N}-]+/u, (match) => `<mark>${match}</mark>`) : one)).join(' ');
  };
  const hits = found.slice((page - 1) * perPage, page * perPage).map(({ document }) => {
    const { body, ...shown } = document;
    const marked = snippet(body);
    return { document: shown, highlights: marked ? [{ field: 'body', snippet: marked }] : [] };
  });
  return { found: found.length, hits, request_params: { per_page: perPage } };
}

const server = createServer(async (request, response) => {
  const address = new URL(request.url, 'http://localhost');
  if (address.pathname === '/_konzilo/search') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify(await searchAnswer(address.searchParams)));
    return;
  }
  const path = decodeURIComponent(address.pathname);
  const file = normalize(join(dist, path.endsWith('/') ? `${path}index.html` : path));
  const found = file.startsWith(dist) && existsSync(file) && statSync(file).isFile();
  response.writeHead(found ? 200 : 404, { 'content-type': TYPES[extname(found ? file : '404.html')] ?? 'application/octet-stream' });
  response.end(readFileSync(found ? file : join(dist, '404.html')));
});
await new Promise((done) => server.listen(0, '127.0.0.1', done));
const origin = `http://127.0.0.1:${server.address().port}`;

// The two browsers behind one small set of calls.
const pause = (ms) => new Promise((done) => setTimeout(done, ms));
async function chromium() {
  const { chromium: engine } = await import('playwright-core');
  const browser = await engine.launch();
  const contexts = new Map();
  return {
    async open(width) {
      if (!contexts.has(width)) contexts.set(width, await browser.newContext({ viewport: { width, height: HEIGHTS[width] ?? 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' }));
      const tab = await contexts.get(width).newPage();
      return { goto: (url) => tab.goto(url, { waitUntil: 'load' }), evaluate: (fn, arg) => tab.evaluate(fn, arg), move: (x, y) => tab.mouse.move(x, y), wheel: (dy) => tab.mouse.wheel(0, dy), screenshot: (full) => tab.screenshot({ fullPage: full }), click: (selector) => tab.click(selector), close: () => tab.close() };
    },
    settle: 250,
    close: () => browser.close(),
  };
}
async function firefox(executablePath) {
  const { default: puppeteer } = await import('puppeteer-core');
  const browser = await puppeteer.launch({ browser: 'firefox', executablePath, protocol: 'webDriverBiDi', headless: true });
  return {
    async open(width) {
      const tab = await browser.newPage();
      await tab.setViewport({ width, height: HEIGHTS[width] ?? 900, deviceScaleFactor: 1 });
      return { goto: (url) => tab.goto(url, { waitUntil: 'load' }), evaluate: (fn, arg) => tab.evaluate(fn, arg), move: (x, y) => tab.mouse.move(x, y), wheel: (dy) => tab.mouse.wheel({ deltaY: dy }), screenshot: async (full) => Buffer.from(await tab.screenshot({ fullPage: full })), click: (selector) => tab.click(selector), close: () => tab.close() };
    },
    settle: 700,
    close: () => browser.close(),
  };
}

// What the frame is doing, from computed style. A shadow is cast where one of an element's box-shadows has a colour
// that shows and a blur: the page's edge always declares two, a hairline and a shadow, transparent while they are off.
const frameState = () => {
  const bar = document.querySelector('.kn-header-bar');
  const main = document.querySelector('.kn-page-main');
  const footer = document.querySelector('.kn-footer');
  const casts = (element) => {
    const value = element ? getComputedStyle(element).boxShadow : 'none';
    if (value === 'none') return false;
    return value.split(/,(?![^(]*\))/).some((layer) => {
      const alpha = /rgba?\([^)]*?,\s*([\d.]+)\)/.exec(layer)?.[1] ?? (/rgb\(/.test(layer) ? '1' : '0');
      const lengths = [...layer.replace(/\([^)]*\)/g, '').matchAll(/(-?[\d.]+)px/g)].map((match) => Number(match[1]));
      return Number(alpha) > 0 && (lengths[2] ?? 0) > 0;
    });
  };
  const shadow = (element) => (casts(element) ? 'shadow' : 'no shadow');
  const header = bar ? `header ${bar.getBoundingClientRect().bottom > 1 ? 'in the window' : 'away'}, ${shadow(bar)}` : 'no header';
  return `${header}; page ${shadow(main)}; footer ${footer ? `fit ${footer.dataset.knFit ?? 'unset'}` : 'none'}; scrolled ${Math.round(scrollY)} of ${document.documentElement.scrollHeight - innerHeight}`;
};

// The whole page. Where the footer lies at the window's edge, a full-page capture paints it at the window's bottom,
// so its last rows, as tall as the footer, are taken from the window scrolled to the end, as the mockups do.
async function wholePage(tab, settle) {
  // A picture that loads lazily loads only near the window, which a full-page capture does not move: load them all.
  await tab.evaluate(() => Promise.all([...document.images].map((image) => {
    image.loading = 'eager';
    return image.decode().catch(() => {});
  })));
  const whole = await tab.screenshot(true);
  const footer = await tab.evaluate(() => {
    const element = document.querySelector('.kn-footer[data-kn-attachment="reveal"][data-kn-fit="true"]');
    return element ? Math.ceil(element.getBoundingClientRect().height) : 0;
  });
  if (!footer) return whole;
  await tab.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await pause(settle);
  const atEnd = await tab.screenshot(false);
  const [{ width, height }, view] = await Promise.all([sharp(whole).metadata(), sharp(atEnd).metadata()]);
  const end = await sharp(atEnd).extract({ left: 0, top: view.height - footer, width, height: footer }).toBuffer();
  return sharp(whole).composite([{ input: end, left: 0, top: height - footer }]).png().toBuffer();
}

// Down by the wheel, as a visitor scrolls, to `target` or as far as the page goes.
async function wheelTo(tab, target, settle) {
  for (let left = target - (await tab.evaluate(() => scrollY)); left >= 1; left = target - (await tab.evaluate(() => scrollY))) {
    const before = await tab.evaluate(() => scrollY);
    // A whole number: WebDriver BiDi takes no other, and Firefox's scroll position may be fractional.
    await tab.wheel(Math.round(Math.min(400, left)));
    await pause(80);
    if ((await tab.evaluate(() => scrollY)) === before) {
      await pause(settle);
      if ((await tab.evaluate(() => scrollY)) === before) break;
    }
  }
}

async function shoot(tab, { width, state, settle }) {
  await tab.evaluate(() => document.fonts.ready);
  if (state === 'scrolled' || state === 'down') {
    await tab.move(width / 2, 400);
    for (let step = 0; step < 6; step += 1) {
      await tab.wheel(250);
      await pause(80);
    }
    await pause(settle);
    if (state === 'scrolled') await tab.wheel(-120);
    await tab.move(1, 600);
  }
  if (state === 'end' || state === 'ending') {
    await tab.move(width / 2, 400);
    const target = await tab.evaluate((ending) => {
      const end = document.documentElement.scrollHeight - innerHeight;
      const footer = document.querySelector('.kn-footer');
      return Math.max(0, ending && footer ? end - Math.round(footer.getBoundingClientRect().height / 2) : end);
    }, state === 'ending');
    await wheelTo(tab, target, settle);
    await tab.move(1, 600);
  }
  if (state === 'menu' || state === 'search') {
    const opened = await tab.evaluate((which) => {
      const dialog = document.querySelector(which === 'menu' ? '.kn-header .kn-megamenu' : '.kn-header .kn-header-search-overlay');
      dialog?.showModal();
      // Opened by a click, the menu shows no focus ring; the search field always does.
      if (which === 'menu') document.activeElement?.blur();
      return !!dialog;
    }, state);
    if (!opened) return { picture: null, said: `the page has no ${state === 'menu' ? 'menu' : 'search box'} to open` };
  }
  await pause(settle);
  const said = await tab.evaluate(frameState);
  const picture = state === 'closed' ? await wholePage(tab, settle) : await tab.screenshot(false);
  return { picture, said };
}

// A shot beside its mockup's, the mockup's on the left, each under its label, and the parts of a tall pair.
async function compare(name, file) {
  const mockup = join(mockups, name);
  if (!existsSync(mockup)) return 'no mockup shot of that name';
  const [left, right] = [mockup, file];
  const [a, b] = await Promise.all([sharp(left).metadata(), sharp(right).metadata()]);
  const gap = 40;
  const top = 44;
  const width = a.width + gap + b.width;
  const height = top + Math.max(a.height, b.height);
  const label = (text, x) => `<text x="${x}" y="30" font-family="Helvetica, Arial, sans-serif" font-size="22" fill="#333">${text}</text>`;
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${top}">${label('Mockup', 0)}${label('Site', a.width + gap)}</svg>`);
  const pair = await sharp({ create: { width, height, channels: 3, background: '#d9d9d9' } })
    .composite([{ input: svg, left: 0, top: 0 }, { input: left, left: 0, top }, { input: right, left: a.width + gap, top }])
    .png().toBuffer();
  const target = join(out, 'compare', name);
  mkdirSync(join(out, 'compare'), { recursive: true });
  writeFileSync(target, pair);
  const PART = 2000;
  for (let part = 0, at = 0; height > PART * 1.1 && at < height; part += 1, at += PART) {
    const piece = await sharp(pair).extract({ left: 0, top: at, width, height: Math.min(PART, height - at) }).png().toBuffer();
    writeFileSync(target.replace(/\.png$/, `.part-${part + 1}.png`), piece);
  }
  return target.replace(ROOT, '');
}

const browser = firefoxPath ? await firefox(firefoxPath) : await chromium();
mkdirSync(out, { recursive: true });
let failed = false;
try {
  for (const width of widths) {
    // The consent banner answered once in this window's storage, as a visitor answers it, unless it is wanted.
    if (!values.banner) {
      const tab = await browser.open(width);
      await tab.goto(`${origin}/`);
      // Firefox's tabs share one storage, where the first width's answer is kept already.
      if (!(await tab.evaluate(() => localStorage.getItem('konzilo-consent')))) {
        await tab.click('.konzilo-consent-banner [data-konzilo-consent-action="reject"]');
        await pause(browser.settle);
      }
      if (!(await tab.evaluate(() => localStorage.getItem('konzilo-consent')))) fail('the consent banner kept no choice');
      await tab.close();
    }
    for (const { name, address } of shots) {
      const tab = await browser.open(width);
      await tab.goto(`${origin}${address}`);
      const { picture, said } = await shoot(tab, { width, state: values.state, settle: browser.settle });
      await tab.close();
      const file = join(out, `${name}-${width}${values.state === 'closed' ? '' : `-${values.state}`}.png`);
      if (!picture) {
        console.error(`${name} at ${width}: ${said}`);
        failed = true;
        continue;
      }
      writeFileSync(file, picture);
      const paired = values.compare ? `; beside its mockup: ${await compare(file.split('/').at(-1), file)}` : '';
      console.log(`${file.replace(ROOT, '')}: ${said}${paired}`);
    }
  }
} finally {
  await browser.close();
  server.close();
}
if (failed) process.exit(1);
