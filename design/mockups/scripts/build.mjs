#!/usr/bin/env node
// Builds mockup pages into dist/ (or --out), each a page that stands alone: plain HTML with its CSS inline, and
// relative addresses to its fonts, logos and pictures, so it opens from the file system.
//
//   npm run build -- <page> [<page> …]     the named pages
//   npm run build -- --all                  every page
//   npm run build -- <page> --out <folder>  into another folder
//
// Each run builds in a folder of its own under .build/ and then copies its pages and their files into the output, so
// two agents can build different pages at the same time. Pictures are made here, from the tokens the pages hold
// (src/lib/pictures.js): design/images/<id>.jpg at the width asked for, or a placeholder that names a missing one.
import { spawnSync } from 'node:child_process';
import { cp, mkdir, readdir, readFile, rename, rm, rmdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DESIGN = resolve(ROOT, '..');
process.chdir(ROOT);
process.env.ASTRO_TELEMETRY_DISABLED = '1';

const args = process.argv.slice(2);
const option = (name) => { const at = args.indexOf(name); if (at < 0) return undefined; const [value] = args.splice(at, 2).slice(1); return value; };
const out = resolve(option('--out') ?? join(ROOT, 'dist'));
const all = args.includes('--all');
const pages = args.filter((arg) => !arg.startsWith('--'));
if (!all && pages.length === 0) {
  console.error('Name the pages to build, such as: npm run build -- catalogue home, or build them all with --all.');
  process.exit(2);
}

// The design's logos, as `konzilo-design logos` writes them, where fromDesign() looks for them.
const designFile = existsSync(join(DESIGN, 'site.design.json')) ? join(DESIGN, 'site.design.json') : join(ROOT, 'src', 'fallback.design.json');
const logos = join(ROOT, 'public', 'logos');
const newer = async (source, target) => !existsSync(target) || (await stat(source)).mtimeMs > (await stat(target)).mtimeMs;
const project = JSON.parse(await readFile(designFile, 'utf8')).project ?? {};
if ((project.logo || project['logo-dark']) && await newer(designFile, logos)) {
  const run = spawnSync(process.execPath, [join(ROOT, 'node_modules/@kntnt/konzilo-design/bin/konzilo-design.js'), 'logos', designFile, '-o', logos], { stdio: 'inherit' });
  if (run.status !== 0) process.exit(run.status ?? 1);
}

// The pictures made in this run, by token.
const made = new Map();

// A build of its own.
const work = join(ROOT, '.build', `${Date.now()}-${process.pid}`);
const built = join(work, 'out');
process.env.MOCKUP_PAGES = all ? '' : pages.join(',');
process.env.MOCKUP_CACHE_DIR = join(work, 'cache');
try {
  const { build } = await import('astro');
  await build({ root: ROOT, outDir: built, logLevel: 'warn' });

  await mkdir(out, { recursive: true });
  const names = (await readdir(built)).filter((file) => file.endsWith('.html'));
  for (const file of names) {
    let html = await readFile(join(built, file), 'utf8');
    html = html.replace(/(["'(=\s])\/_astro\//g, '$1_astro/');
    html = await inlineModules(html);
    html = await pictures(html);
    await atomicWrite(join(out, file), html);
  }
  for (const folder of ['_astro', 'logos']) {
    if (existsSync(join(built, folder))) await cp(join(built, folder), join(out, folder), { recursive: true, force: true });
  }
  // A stylesheet left as a file addresses its fonts from the root; from beside them they are its neighbours.
  for (const file of existsSync(join(out, '_astro')) ? await readdir(join(out, '_astro')) : []) {
    if (!file.endsWith('.css')) continue;
    const css = await readFile(join(out, '_astro', file), 'utf8');
    if (css.includes('/_astro/')) await writeFile(join(out, '_astro', file), css.replace(/\/_astro\//g, './'));
  }
  console.log(`Built ${names.map((file) => join(out, file).replace(`${ROOT}/`, '')).join(', ')}`);
} finally {
  await rm(work, { recursive: true, force: true });
  // The folder of builds goes once no build is left in it.
  await rmdir(join(ROOT, '.build')).catch(() => {});
}

async function atomicWrite(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, data);
  await rename(temporary, path);
}

// A module script with no import of its own is written into the page, since a browser runs no module from a file:
// address. It is still a module, so it runs when it would have.
async function inlineModules(html) {
  const found = [...html.matchAll(/<script([^>]*?)\stype="module"([^>]*?)\ssrc="(_astro\/[^"]+)"([^>]*)><\/script>/g)];
  for (const [whole, before, middle, src, after] of found) {
    const code = await readFile(join(built, src), 'utf8');
    if (/\bimport\b/.test(code)) continue;
    html = html.replace(whole, `<script${before} type="module"${middle}${after}>${code.replace(/<\/script/gi, '<\\/script')}</script>`);
  }
  return html;
}

// ---------- Pictures ----------

function missing(label, width, height) {
  // The id a third of the way down, in the middle, which a cropped picture keeps and a hero's text seldom covers.
  const size = Math.round(Math.min(40, height / 3.2));
  const box = Math.round(label.length * size * 0.56 + size);
  const [x, y] = [(width - box) / 2, height * 0.32 - size * 0.9];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#d5d9d6"/><path d="M0 0L${width} ${height}M${width} 0L0 ${height}" stroke="#c2c7c3" stroke-width="2"/><rect x="${x}" y="${y}" width="${box}" height="${size * 1.8}" rx="6" fill="#f4f5f4"/><text x="${width / 2}" y="${y + size * 0.9}" dominant-baseline="central" text-anchor="middle" font-family="system-ui, sans-serif" font-size="${size}" fill="#3d4440">${label}</text></svg>`;
}

async function asset(token) {
  if (made.has(token)) return made.get(token);
  const [, kind, name, width] = /^mockup-(image|logo):([\w-]+)(?:\?w=(\d+))?$/.exec(token);
  let result;
  if (kind === 'image') {
    const source = ['jpg', 'jpeg', 'png', 'webp'].map((ext) => join(DESIGN, 'images', `${name}.${ext}`)).find(existsSync);
    if (source) {
      const target = join(out, 'images', `${name}-${width}.jpg`);
      if (await newer(source, target)) {
        const buffer = await sharp(source).rotate().resize({ width: Number(width), withoutEnlargement: true }).jpeg({ quality: 78, mozjpeg: true }).toBuffer();
        await atomicWrite(target, buffer);
      }
      const { width: w, height: h } = await sharp(target).metadata();
      result = { src: `images/${name}-${width}.jpg`, width: w, height: h };
    } else {
      const target = join(out, 'images', `missing-${name}.svg`);
      await atomicWrite(target, missing(`image:${name}`, 1200, 800));
      result = { src: `images/missing-${name}.svg`, width: 1200, height: 800 };
    }
  } else {
    // logo:<name> is design/logo/<name>, its customers/<name>, or <name>-logo, of any kind of picture.
    const source = ['', 'customers/'].flatMap((folder) => [name, `${name}-logo`].flatMap((stem) => ['svg', 'png', 'webp', 'jpg'].map((ext) => join(DESIGN, 'logo', `${folder}${stem}.${ext}`)))).find(existsSync);
    if (source) {
      const file = source.slice(source.lastIndexOf('/') + 1);
      const target = join(out, 'logo', file);
      if (await newer(source, target)) await atomicWrite(target, await readFile(source));
      result = { src: `logo/${file}` };
    } else {
      const target = join(out, 'logo', `missing-${name}.svg`);
      await atomicWrite(target, missing(`logo:${name}`, Math.max(480, name.length * 18 + 120), 120));
      result = { src: `logo/missing-${name}.svg` };
    }
  }
  made.set(token, result);
  return result;
}

async function pictures(html) {
  const tokens = [...new Set(html.match(/mockup-(?:image|logo):[\w-]+(?:\?w=\d+)?/g) ?? [])];
  for (const token of tokens) await asset(token);
  // An <img> takes the picture's size too, as the core writes it.
  html = html.replace(/<img\b[^>]*>/g, (element) => {
    const src = /\ssrc="(mockup-[^"]+)"/.exec(element)?.[1];
    if (!src) return element;
    const { src: file, width, height } = made.get(src);
    let written = element.replace(src, file);
    if (width && !/\swidth=/.test(written)) written = written.replace(/^<img/, `<img width="${width}" height="${height}"`);
    return written;
  });
  for (const token of tokens) html = html.split(token).join(made.get(token).src);
  return html;
}
