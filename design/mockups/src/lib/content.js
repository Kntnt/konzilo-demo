// The site's content in design/content/: its posts, as Markdown files with YAML frontmatter, its terms, as JSON files
// in the collections categories, topics and authors, and site.json. Read afresh by every build, since the text
// changes while pages are built.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative, sep } from 'node:path';
import { parse } from 'yaml';
import { CONTENT } from './paths.js';

function walk(folder, found = []) {
  if (!existsSync(folder)) return found;
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(folder, entry.name);
    if (entry.isDirectory()) walk(path, found);
    else found.push(path);
  }
  return found;
}

// A post's file split into its frontmatter and its body, as Astro splits it.
export function readPost(path) {
  const text = readFileSync(path, 'utf8');
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  const data = match ? parse(match[1]) ?? {} : {};
  const body = (match ? match[2] : text).trim();
  return { data, body };
}

// The mockup's name for an address: / is home, /solutions/rooftop-solar/ is solutions-rooftop-solar.
export const nameOfAddress = (address) => address.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '-') || 'home';

// A post without an address in its frontmatter is named by its path: articles/winter-solar.md is articles-winter-solar.
const nameOfFile = (file) => file.replace(/\.md$/, '').replace(/(^|\/)index$/, '').split(sep).join('-') || 'home';

// A post's type by its collection, the folder it stands in, where its frontmatter does not name one, and the address
// of a type whose posts give none, as the site description will declare them (design/content/README.md).
const TYPES = { pages: 'page', canvases: 'canvas', articles: 'article', 'case-studies': 'case-study', jobs: 'job', system: 'page' };
const ADDRESSES = { article: '/insights/{slug}/', 'case-study': '/customers/{slug}/', job: '/about/careers/{slug}/', canvas: '/go/{slug}/' };

let cache;
// Every post, as { file, path, name, address, type, slug, data, body }. A Markdown file without frontmatter, such as a
// README, is no post.
export function posts() {
  if (cache) return cache;
  cache = walk(CONTENT).filter((path) => path.endsWith('.md') && /^---\r?\n/.test(readFileSync(path, 'utf8'))).map((path) => {
    const file = relative(CONTENT, path);
    const { data, body } = readPost(path);
    const collection = file.split(sep)[0];
    const type = data.type ?? TYPES[collection] ?? 'page';
    const slug = basename(file, '.md') === 'index' ? basename(join(file, '..')) : basename(file, '.md');
    const address = typeof data.address === 'string' ? data.address : ADDRESSES[type]?.replace('{slug}', slug);
    // A system page, such as the 404 page, has no address of its own and is named by its slug.
    const name = collection === 'system' && !address ? slug : address ? nameOfAddress(address) : nameOfFile(file);
    return { file, path, name, address, type, slug, collection, data, body };
  });
  return cache;
}

export const postByName = (name) => posts().find((post) => post.name === name);
export const postByFile = (file) => posts().find((post) => post.file === file || post.file === `${file}.md`);
export const postByAddress = (address) => posts().find((post) => post.address === address);

// The terms of a taxonomy, by slug: { name, description, parent }. A term file stands in a folder named for its
// collection, anywhere under design/content.
const terms = {};
export function termsOf(collection) {
  if (terms[collection]) return terms[collection];
  const found = {};
  for (const path of walk(CONTENT)) {
    const parts = relative(CONTENT, path).split(sep);
    if (!path.endsWith('.json') || parts.at(-2) !== collection) continue;
    try { found[basename(path, '.json')] = JSON.parse(readFileSync(path, 'utf8')); } catch { /* a file being written */ }
  }
  terms[collection] = found;
  return found;
}
export const termName = (collection, slug) => termsOf(collection)[slug]?.name ?? slug.replace(/-/g, ' ').replace(/^./, (first) => first.toUpperCase());

// design/content/site.json, or an empty object while it does not exist.
export function siteContent() {
  const path = join(CONTENT, 'site.json');
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}
