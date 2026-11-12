#!/usr/bin/env node
// Screenshots of built mockup pages, as full-page PNG files in shots/, in light mode at 1440 and 390 px wide.
//
//   npm run shoot -- <page> [<page> …]          shots/<page>-1440.png and shots/<page>-390.png
//   npm run shoot -- <page> --dark              also in dark mode, shots/<page>-1440-dark.png …
//   npm run shoot -- <page> --state menu        the header's menu open, the window alone: shots/<page>-1440-menu.png
//   npm run shoot -- <page> --state search      the header's search box open, likewise
//   npm run shoot -- <page> --state scrolled    the window scrolled down and a little back up, so that the header has
//                                               come back over the content: shots/<page>-1440-scrolled.png
//   npm run shoot -- <page> --widths 1024,768   other widths
//   npm run shoot -- --all                      every page built in dist/
//   --dist <folder> and --out <folder> read and write elsewhere.
//
// A page is opened from the file system, as it is built: run npm run build -- <page> first.
import { existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const option = (name) => { const at = args.indexOf(name); if (at < 0) return undefined; const [value] = args.splice(at, 2).slice(1); return value; };
const dist = resolve(option('--dist') ?? join(ROOT, 'dist'));
const out = resolve(option('--out') ?? join(ROOT, 'shots'));
const widths = (option('--widths') ?? '1440,390').split(',').map(Number);
const state = option('--state') ?? 'closed';
const modes = args.includes('--dark') ? ['light', 'dark'] : ['light'];
let pages = args.filter((arg) => !arg.startsWith('--'));
if (args.includes('--all')) pages = (await readdir(dist)).filter((file) => file.endsWith('.html')).map((file) => file.slice(0, -5));
if (!pages.length) { console.error('Name the pages to shoot, such as: npm run shoot -- catalogue'); process.exit(2); }
if (!['closed', 'menu', 'search', 'scrolled'].includes(state)) { console.error('--state is closed, menu, search or scrolled'); process.exit(2); }

const HEIGHTS = { 390: 844, 768: 1024, 1024: 768, 1440: 900 };
await mkdir(out, { recursive: true });
// The catalogue's frames are pages of their own: kept in the page's process, a full-page capture paints them all.
const browser = await chromium.launch({ args: ['--allow-file-access-from-files', '--disable-site-isolation-trials', '--disable-features=IsolateOrigins,site-per-process'] });
try {
  for (const page of pages) {
    const file = join(dist, `${page}.html`);
    if (!existsSync(file)) { console.error(`${file} is not built: npm run build -- ${page}`); process.exitCode = 1; continue; }
    for (const width of widths) {
      for (const mode of modes) {
        const tab = await browser.newPage({ viewport: { width, height: HEIGHTS[width] ?? 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        await tab.goto(pathToFileURL(file).href, { waitUntil: 'load' });
        if (mode === 'dark') await tab.evaluate(() => document.documentElement.setAttribute('data-kn-mode', 'dark'));
        await tab.evaluate(() => document.fonts.ready);
        // A header that slides away comes back on the first scroll up: scroll down by the wheel, as a visitor does, and
        // a little back up, so that the bar stands over the content.
        if (state === 'scrolled') {
          await tab.mouse.move(width / 2, 400);
          for (let step = 0; step < 6; step++) { await tab.mouse.wheel(0, 250); await tab.waitForTimeout(80); }
          await tab.waitForTimeout(200);
          await tab.mouse.wheel(0, -120);
          // The pointer goes to the side margin, so that no card shows its hover.
          await tab.mouse.move(1, 600);
          await tab.waitForTimeout(300);
        }
        if (state === 'menu' || state === 'search') {
          const opened = await tab.evaluate((which) => {
            const dialog = document.querySelector(which === 'menu' ? '.kn-header .kn-megamenu' : '.kn-header .kn-header-search-overlay');
            dialog?.showModal();
            // Opened by a click, the menu shows no focus ring; the search field always does.
            if (which === 'menu') document.activeElement?.blur();
            return !!dialog;
          }, state);
          if (!opened) console.error(`${page}: the header has no ${state === 'menu' ? 'menu' : 'search box'} to open`);
        }
        // A frame the window never showed is not painted, and a dialog that takes the focus in a frame scrolls the
        // page to it: show each frame once, and go back to the top.
        if (state === 'closed') {
          for (const frame of await tab.$$('iframe')) { await frame.scrollIntoViewIfNeeded(); await tab.waitForTimeout(150); }
          await tab.evaluate(() => window.scrollTo(0, 0));
        }
        await tab.waitForTimeout(250);
        const name = `${page}-${width}${mode === 'dark' ? '-dark' : ''}${state === 'closed' ? '' : `-${state}`}.png`;
        await tab.screenshot({ path: join(out, name), fullPage: state === 'closed' });
        console.log(join(out, name).replace(`${ROOT}/`, ''));
        await tab.close();
      }
    }
  }
} finally {
  await browser.close();
}
