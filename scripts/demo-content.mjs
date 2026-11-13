#!/usr/bin/env node
// Makes demo-content/, the site's published demo content (Konzilo's ADR 0025), from the design: the texts in
// design/content/, the pictures in design/images/ and the logos in design/logo/. design/content/ stays the one
// place a text is written. This script writes it as source files, as an editor's saves would leave them, and the
// core's own intake command makes the content files from them, so that demo-content/ holds exactly what the core
// would publish. It stops, writing nothing, at any refusal or warning of the intake, at any post that is not
// live, and at anything in design/content/ it does not know how to carry over.
//
//   node scripts/demo-content.mjs            make demo-content/ again, and remove content/ if it was a copy
//   node scripts/demo-content.mjs --force    the same, even where nothing it is made from has changed
//   node scripts/demo-content.mjs --credits  print each master in demo-content/ with its picture's credit, as JSON
//
// The same design always gives the same bytes: the intake runs at a fixed moment (scripts/lib/intake.mjs). So
// where nothing it is made from has changed since it last made demo-content/, and demo-content/ is as it made
// it, the script leaves both as they are: what it is made from is design/content/, design/images/,
// design/logo/, site-description.json, these scripts and package-lock.json, which pins the core.
//
// content/, the folder the site is built from ($KONZILO_CONTENT, else content/), is a copy of demo-content/
// that `konzilo-demo-content` makes where there is none. Where content/ is that copy, this script removes it, so
// that the next step copies the new demo content. Where it is anything else, such as the content repository
// Compose's builder builds from, the site is built from content of its own: the script says so and changes
// nothing, since demo content has no use there.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { creditsOfMasters } from './lib/credits.mjs';
import { digestOf, filesIn, replaceWithCopy, sameFiles } from './lib/files.mjs';
import { coreModule, countsOf, DEMO_MOMENT, ROOT, runIntake, shortfalls } from './lib/intake.mjs';
import { searchTexts } from '../src/lib/search-texts.js';

// What the core cannot hold yet, and so is left out of the demo content, or stood in for, each with what it
// waits for. To put one back, delete its entry and the code that names it (`LEFT_OUT.<name>`).
export const LEFT_OUT = {
  scheduled: {
    what: 'A post dated after the moment the content is made at: the scheduled article, grid-capacity-is-now-the-scarce-resource.md, dated 2027-12-01.',
    waits: 'Demo content that can hold a scheduled post: a content file has no status, and Compose\'s seed writes every demo post as published (src/demo-source.js:125 in the core).',
  },
  menuDescriptions: {
    what: 'The line of description under each second-level entry of the main menu, in design/content/site.json, is left out of the menu file. The frame stands in for it: withDescriptionsStandIn() in src/lib/frame.js takes the lines from site.json by each entry\'s address.',
    waits: 'A description on a menu entry in the core, whose intake writes an entry as title, url and items alone (src/intake/menus.js), and Konzilo Design\'s menuProps passing it on; then this script writes it, and the stand-in goes.',
  },
  labelLinks: {
    what: 'The link in a form field\'s label, "[privacy policy](/privacy-policy/)" in each acceptance field; site-description.json gives the label as its words alone.',
    waits: 'A link in a form field\'s label: the core writes a label as plain text (src/site-description.js, FormView.astro).',
  },
  formButtons: {
    what: 'A form\'s own button text. design/content/ gives none, and the design draws the core\'s "Send", so nothing is left out today.',
    waits: 'A button text of a form\'s own, which ADR 0045 of the core promises and neither the site description nor ::form takes.',
  },
  modified: {
    what: 'A post\'s own day of last change, `modified` in design/content/; each post\'s is its date.',
    waits: 'Nothing that is planned: the core derives `modified` from the post\'s history, and no source file sets it (src/intake/post-file.js:3).',
  },
  filterCounts: {
    what: 'A filtered list\'s count and pills over all its pages: it counts and offers the terms of the posts its page shows, "Showing 9 articles" where the design says "Showing 9 of 17 articles", and on a topic\'s page it counts the case studies among them as articles. The page tells the presentation what it lists by the types givePageContext() gives it (src/lib/design-page.js).',
    waits: 'The core\'s next release, which hands a presentation its `list`, with the terms and the count over every page (Konzilo Design\'s docs/spec/konzilo.md, The directives and the presentations).',
  },
  searchByTerm: {
    what: 'A search from a term\'s page that keeps to the term: the filtered list sends the term its page settles as a hidden field, which the core\'s search does not read, so the search covers the whole site (src/components/TermPage.astro).',
    waits: 'The core\'s search narrowed by terms, in its next release.',
  },
  home: {
    what: 'The Home page at /: it stands at /home/, and the start route (src/pages/[...start].astro) shows its content at /.',
    waits: 'The owner\'s decision whether an editor may choose a page for the start page; the core keeps / for the site\'s own start page (src/format/rules.json, src/intake/addresses.js).',
  },
};

// What design/content/site.json holds that is no content file's, and why it is not carried over here.
//  - `slogan`: the design file's `project.slogan` holds it, and Konzilo Design's header reads it from there.
//  - `header.search.label`: the search texts' `label` (design/content/system/search.md, read by astro.config.mjs),
//    which the core's search box and the header's both take; this script holds the two to the same words.
//  - `footer.upper.a1`, `footer.upper.b2` and `footer.lower.b2` describe cells the frame fills from the design,
//    the main menu and the core's consent controls.
const FRAME_ONLY = ['slogan', 'header.search.label', 'footer.upper.a1', 'footer.upper.b2', 'footer.lower.b2'];

// The legal pages the core's settings choose, by their addresses; the footer's legal links must be these.
const LEGAL_PAGES = { privacyPolicy: '/privacy-policy/', cookiePolicy: '/cookie-policy/', accessibilityStatement: '/accessibility/' };

// The site's identity in its settings: the logo and the site icon, files in design/logo/.
const IDENTITY = { logo: 'ampfield-logo', icon: 'ampfield-mark' };

// The meta line of an article, as the mockups write it (design/mockups/src/lib/article.js, META_LINE_FORMAT).
const META_LINE_FORMAT = 'By {authors} • Published {date} in {category}';

// The words the templates show that no post holds, each a setting of the site's own (site-description.json), in the
// mockups' words: design/mockups/src/lib/article.js (Read more), types.js (the case study and the vacancy) and terms.js
// (a term's page). A page is named by its address and set as the post at it.
const TEMPLATE_WORDS = {
  articleMoreLabel: 'More articles',
  articleMorePage: '/insights/',
  caseStudyFactsHeading: 'The project',
  caseStudyMoreHeading: 'More case studies',
  caseStudyMoreLabel: 'All case studies',
  caseStudyMorePage: '/customers/',
  caseStudyClosingHeading: 'Find out what your site can do',
  caseStudyClosingText: 'An engineer visits, measures the roof, looks at the switch room and reads a year of your meter data. Within two weeks you have a report with the systems that fit, what they would give and what they cost.',
  caseStudyClosingAction: 'Book a site assessment',
  caseStudyClosingActionPage: '/go/site-assessment/',
  caseStudyClosingOtherAction: 'Ask for a reference',
  caseStudyClosingOtherActionPage: '/contact/',
  vacancyApplyLabel: 'How to apply',
  vacancyMenuLabel: 'On this page',
  vacancyOthersHeading: 'Other vacancies',
  vacancyAllLabel: 'All vacancies',
  vacancyAllPage: '/about/careers/',
  vacancyAllAnchor: 'open-positions',
  termNewsletterHeading: 'One e-mail a month',
  termNewsletterText: 'The month\'s articles, one chart from our analyst on prices and grid fees, and nothing else. Every issue has a link to unsubscribe.',
  termNewsletterNote: 'We keep your address only to send the newsletter. Read [how we handle personal data](/privacy-policy/).',
};

// Where a post of each kind is in design/content/, by the folder, and the post type it is.
const POST_FOLDERS = { pages: 'page', canvases: 'canvas', articles: 'article', 'case-studies': 'case-study', jobs: 'job' };
// A type whose eyebrow, the label its teaser shows where it has no category (Konzilo Design's teaserOf()), is a field
// of its own where design/content/ leaves the eyebrow out: a case study's customer, as the design shows it. The field
// stays, since the core lets a site neither label its eyebrow for an editor nor require it, and the case study's facts
// show the customer as a value of its own.
const EYEBROW_FROM = { 'case-study': 'customer' };
// The files in design/content/ that are no post or term: what describes the content, and the search page's words.
const NOT_POSTS = new Set(['README.md', 'editorial.md', 'site.json', 'system/search.md']);
// The post an Admin chooses for addresses not found.
const NOT_FOUND = 'system/not-found.md';

const DESIGN = join(ROOT, 'design');
const SOURCE = join(DESIGN, 'content');
const IMAGES = join(DESIGN, 'images');
const LOGOS = join(DESIGN, 'logo');
const DEMO = join(ROOT, 'demo-content');
const CONTENT = resolve(ROOT, process.env.KONZILO_CONTENT ?? 'content');
const CACHE = join(ROOT, 'node_modules/.cache/konzilo-demo');
const WORK = join(CACHE, 'demo-content');
// What the last run made from what: { inputs, output }, each a digest.
const MADE = join(CACHE, 'demo-content.json');
// package-lock.json stands for the packages, the core and Konzilo Design, whose intake and directive checks run.
const INPUTS = ['design/content', 'design/images', 'design/logo', 'design/site.design.json', 'site-description.json', 'scripts/demo-content.mjs', 'scripts/lib', 'package-lock.json'];

// One digest of everything demo-content/ is made from.
function inputsDigest() {
  const hash = createHash('sha256');
  for (const input of INPUTS) {
    const at = join(ROOT, input);
    if (!existsSync(at)) continue;
    const paths = statSync(at).isDirectory() ? filesIn(at).map((path) => `${input}/${path}`) : [input];
    for (const path of paths) hash.update(`${path}\0`).update(readFileSync(join(ROOT, path))).update('\0');
  }
  return hash.digest('hex');
}

class Stop extends Error {}
const stop = (message) => {
  throw new Stop(message);
};

// An ID as Compose's seed gives one (idOf() in the core's src/demo-source.js), from a post's or a term's place,
// so that these source files and the seed's name each thing alike.
const idOf = (collection, place) => createHash('sha256').update(`${collection}/${place}`).digest('hex').slice(0, 12);

const read = (path) => readFileSync(join(SOURCE, path), 'utf8');

// A file of design/content/: its frontmatter, each key on one line with a value written as JSON, or a moment,
// a day or a word left bare, then its body.
function readPost(path) {
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(read(path));
  if (!match) stop(`${path}: has no frontmatter between two lines of ---`);
  const fields = {};
  for (const line of match[1].split('\n')) {
    const pair = /^([A-Za-z]+): (.+)$/.exec(line);
    if (!pair) stop(`${path}: a line of its frontmatter is no "key: value" on one line: ${line}`);
    const [, key, text] = pair;
    if (Object.hasOwn(fields, key)) stop(`${path}: ${key} is in its frontmatter twice`);
    try {
      fields[key] = /^["[{]|^(true|false|-?\d+(\.\d+)?)$/.test(text) ? JSON.parse(text) : text;
    } catch {
      stop(`${path}: the value of ${key} is no JSON: ${text}`);
    }
  }
  return { fields, body: match[2] };
}

// A value in a source file's frontmatter: a moment or a day bare, as YAML reads it as a date, anything else JSON.
const scalar = (value) => (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}Z)?$/.test(value) ? value : JSON.stringify(value));
const postFile = (fields, body) => `---\n${Object.entries(fields).map(([key, value]) => `${key}: ${scalar(value)}`).join('\n')}\n---\n${body}`;
const jsonFile = (value) => `${JSON.stringify(value, null, 2)}\n`;

// A regular expression of a type's or a taxonomy's address, its slug or path caught.
const addressPattern = (address) => new RegExp(`^${address.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace('{slug}', '([a-z0-9_-]+)').replace('{path}', '([a-z0-9_-]+(?:/[a-z0-9_-]+)*)')}$`);
const fill = (address, place) => address.replace('{slug}', place).replace('{path}', place);

async function makeSource(site, out) {
  // Each source file by its path, and the file of design/content/ it was made from.
  const names = new Map();
  const write = (path, contents, from) => {
    mkdirSync(dirname(join(out, path)), { recursive: true });
    writeFileSync(join(out, path), contents);
    names.set(path, `design/content/${from}`);
  };
  const left = { scheduled: [], menuDescriptions: [], labelLinks: [], modified: [] };

  // Every picture by its id in design/images/credits.json, and every logo by its name in design/logo/.
  const credits = new Map(JSON.parse(readFileSync(join(IMAGES, 'credits.json'), 'utf8')).map((credit) => [credit.id, credit]));
  const originals = new Map();
  const picture = (ref, where) => {
    const [, kind, name] = /^(image|logo):([a-z0-9-]+)$/.exec(ref) ?? stop(`${where}: ${ref} is no picture, image:<id> or logo:<name>`);
    let file;
    if (kind === 'image') {
      const credit = credits.get(name) ?? stop(`${where}: design/images/credits.json has no picture ${name}`);
      file = join(IMAGES, credit.file);
    } else {
      file = [join(LOGOS, `${name}.svg`), join(LOGOS, 'customers', `${name}.svg`)].find(existsSync) ?? stop(`${where}: design/logo/ has no logo ${name}`);
    }
    if (!existsSync(file)) stop(`${where}: ${ref} is ${file}, which is not there`);
    const fileName = basename(file);
    if (originals.has(fileName) && originals.get(fileName) !== file) stop(`${where}: two pictures are called ${fileName}`);
    originals.set(fileName, file);
    return `/media/${fileName}`;
  };

  // The posts, each with its place, address and ID.
  const posts = [];
  const terms = new Map(Object.values(site.taxonomies).map((taxonomy) => [taxonomy.name, new Map()]));
  const typeOf = (name) => site.types[name] ?? stop(`site-description.json declares no type ${name}`);
  for (const path of filesIn(SOURCE)) {
    if (NOT_POSTS.has(path)) continue;
    const [folder] = path.split('/');
    const taxonomy = Object.values(site.taxonomies).find((one) => one.collection === folder);
    if (taxonomy) {
      const slug = /^[^/]+\/([a-z0-9_-]+)\.json$/.exec(path)?.[1] ?? stop(`${path}: a term is <collection>/<slug>.json`);
      const { name, description, parent, ...rest } = JSON.parse(read(path));
      if (Object.keys(rest).length > 0) stop(`${path}: a term holds a name, a description and a parent, not ${Object.keys(rest).join(', ')}`);
      terms.get(taxonomy.name).set(slug, { name, description, parent, path, id: idOf(taxonomy.collection, slug) });
      continue;
    }
    const notFound = path === NOT_FOUND;
    if (!notFound && (!Object.hasOwn(POST_FOLDERS, folder) || !path.endsWith('.md'))) stop(`design/content/${path} is no file this script knows how to carry over`);
    const type = typeOf(notFound ? 'page' : POST_FOLDERS[folder]);
    const { fields, body } = readPost(path);
    if (fields.type !== undefined && fields.type !== type.name) stop(`${path}: says it is a ${fields.type}, in the folder of ${type.name}`);
    let place;
    let address = null;
    if (notFound) {
      place = 'not-found';
    } else if (type.name === 'page' && fields.address === '/') {
      // LEFT_OUT.home: the core keeps / for the site's start page.
      if (path !== 'pages/index.md') stop(`${path}: the page at / is pages/index.md`);
      place = 'home';
      address = fill(type.address, place);
    } else if (fields.address !== undefined) {
      const match = addressPattern(type.address).exec(fields.address) ?? stop(`${path}: ${fields.address} is no address of a ${type.name}, ${type.address}`);
      place = match[1];
      address = fields.address;
      const files = type.hierarchical ? [`${folder}/${place}.md`, `${folder}/${place}/index.md`] : [`${folder}/${place}.md`];
      if (!files.includes(path)) stop(`${path}: its address, ${address}, says it is ${files.join(' or ')}`);
    } else {
      if (type.name === 'page' || type.name === 'canvas') stop(`${path}: a ${type.name} says its address`);
      place = /^[^/]+\/([a-z0-9_-]+)\.md$/.exec(path)?.[1] ?? stop(`${path}: a ${type.name} is ${folder}/<slug>.md`);
      address = fill(type.address, place);
    }
    posts.push({ path, type, fields, body, place, address, id: idOf(type.collection, place), notFound });
  }

  // What a link may lead to: a post by its address, a term's page, and the site's own pages that are no post.
  const postAt = new Map(posts.filter((post) => post.address).map((post) => [post.address, post]));
  const termAt = new Map();
  for (const taxonomy of Object.values(site.taxonomies)) {
    if (!taxonomy.address) continue;
    for (const [slug, term] of terms.get(taxonomy.name)) termAt.set(fill(taxonomy.address, slug), term);
  }
  const feeds = Object.values(site.types).map((type) => type.feed).filter(Boolean);
  const pagesOfItsOwn = new Set(['/', site.search?.address, ...feeds].filter(Boolean));
  // A link's target as an editor's save holds it: a post or a term by its ID, else as it is.
  const target = (href, where, own) => {
    if (/^(https?:|mailto:|tel:)/.test(href)) return href;
    if (href.startsWith('#')) {
      if (!own) stop(`${where}: links to ${href} alone, where there is no post to name`);
      return `konzilo:${own.id}${href}`;
    }
    const [address, fragment] = href.split('#');
    if (!address.startsWith('/')) stop(`${where}: links to ${href}, which is no address on the site, http, https, mailto or tel`);
    const fragmentPart = fragment === undefined ? '' : `#${fragment}`;
    const post = postAt.get(address);
    if (post) return `konzilo:${post.id}${fragmentPart}`;
    const term = termAt.get(address);
    if (term) return `konzilo:${term.id}${fragmentPart}`;
    if (pagesOfItsOwn.has(address)) return href;
    return stop(`${where}: links to ${href}, which no post, term or page of the site's own is at`);
  };

  // A body as an editor's save holds it: pictures by their originals in media/, links to posts and terms by ID.
  const bodyOf = (post) => {
    if (/^\s*\[[^\]^]+\]:\s/m.test(post.body)) stop(`${post.path}: holds a link reference definition, which this script does not carry over`);
    if (/<a\s[^>]*href=/i.test(post.body)) stop(`${post.path}: holds an HTML link, which this script does not carry over`);
    const body = post.body.replace(/(!?)\[((?:[^[\]\n]|\[[^\]\n]*\])*)\]\(([^()\s]+)\)/g, (whole, bang, text, href) => {
      if (bang) return `![${text}](${picture(href, post.path)})`;
      return `[${text}](${target(href, post.path, post)})`;
    });
    if (/\((?:image|logo):/.test(body)) stop(`${post.path}: refers to a picture where this script does not find it`);
    return body;
  };

  const termId = (taxonomy, slug, where) => (terms.get(taxonomy.name).get(slug) ?? stop(`${where}: names the ${taxonomy.name} ${slug}, which design/content/${taxonomy.collection}/ has not got`)).id;

  for (const post of posts) {
    const { path, type, fields, place } = post;
    const fieldsOf = new Map(type.fields.map((field) => [field.name, field]));
    const segments = place.split('/');
    const written = { title: fields.title ?? stop(`${path}: has no title`), slug: segments.at(-1) };
    if (type.hierarchical && segments.length > 1) {
      const parent = segments.slice(0, -1).join('/');
      if (!posts.some((one) => one.type === type && one.place === parent)) stop(`${path}: stands below ${parent}, which no ${type.name} is`);
      written.parent = idOf(type.collection, parent);
    }
    written.status = 'published';
    const date = fields.date ?? (type.name === 'page' || type.name === 'canvas' ? DEMO_MOMENT : stop(`${path}: a ${type.name} has its date`));
    if (new Date(date) > new Date(DEMO_MOMENT)) {
      // LEFT_OUT.scheduled
      left.scheduled.push(path);
      continue;
    }
    written.date = date;
    for (const [key, value] of Object.entries(fields)) {
      if (['type', 'address', 'title', 'date'].includes(key)) continue;
      if (key === 'modified') {
        // LEFT_OUT.modified
        if (value !== date) left.modified.push(path);
        continue;
      }
      if (key === 'description' && fieldsOf.has('seo')) {
        written.search = { description: value };
        continue;
      }
      const field = fieldsOf.get(key) ?? stop(`${path}: ${key} is no field of a ${type.name}`);
      if (field.kind === 'terms') written[key] = value.map((slug) => termId(field.taxonomy, slug, path));
      else if (field.kind === 'image') written[key] = { ...value, src: picture(value.src, path) };
      else if (field.kind === 'teaser') written[key] = value.image ? { ...value, image: { ...value.image, src: picture(value.image.src, path) } } : value;
      else if (field.kind === 'seo') stop(`${path}: sets seo, which this script does not carry over; write description`);
      else written[key] = value;
    }
    const eyebrowFrom = EYEBROW_FROM[type.name];
    if (eyebrowFrom && written.eyebrow === undefined && written[eyebrowFrom] !== undefined) written.eyebrow = written[eyebrowFrom];
    write(`${type.collection}/${post.id}.md`, postFile(written, bodyOf(post)), path);
  }

  for (const taxonomy of Object.values(site.taxonomies)) {
    for (const [slug, { name, description, parent, id, path }] of terms.get(taxonomy.name)) {
      const parentId = parent === undefined ? undefined : termId(taxonomy, parent, `${taxonomy.collection}/${slug}.json`);
      write(`${taxonomy.collection}/${id}.json`, jsonFile({ name, slug, ...(description === undefined ? {} : { description }), ...(parentId === undefined ? {} : { parent: parentId }) }), path);
    }
  }

  // The settings and the menus, from design/content/site.json.
  const given = JSON.parse(read('site.json'));
  const known = ['title', 'description', 'publisher', 'header', 'menu', 'footer', 'forms', 'cookieDeclaration', ...FRAME_ONLY.filter((one) => !one.includes('.'))];
  const unknown = Object.keys(given).filter((key) => !known.includes(key));
  const carried = new Set(['cookieDeclaration.note', 'header.cta', 'header.menuWord', 'header.search', 'header.search.word', 'header.search.links', 'footer.upper.b1', 'footer.upper.a2', 'footer.lower.a1', 'footer.lower.b1', 'footer.lower.a2']);
  for (const [at, part] of Object.entries({ header: given.header, 'header.search': given.header.search ?? {}, 'footer.upper': given.footer.upper, 'footer.lower': given.footer.lower, cookieDeclaration: given.cookieDeclaration ?? {} })) {
    unknown.push(...Object.keys(part).map((key) => `${at}.${key}`).filter((key) => !carried.has(key) && !FRAME_ONLY.includes(key)));
  }
  if (unknown.length > 0) stop(`site.json: holds ${unknown.join(', ')}, which this script does not carry over`);
  // The search field's label is the core's search texts', which the header takes too.
  const { label: searchLabel } = searchTexts();
  if (given.header.search?.label !== undefined && given.header.search.label !== searchLabel) stop(`site.json: header.search.label is "${given.header.search.label}", and design/content/system/search.md gives site.search.label as "${searchLabel}"; the header's search field takes the latter`);
  const postId = (address, where) => (postAt.get(address) ?? stop(`${where}: names ${address}, which no post is at`)).id;
  const notFound = posts.find((post) => post.notFound) ?? stop(`${NOT_FOUND} is missing`);

  const entries = (items, where) => items.map(({ title, url, items: under, description, ...rest }, at) => {
    const here = `${where}.${at + 1}`;
    if (Object.keys(rest).length > 0) stop(`site.json: the menu's entry ${here} holds ${Object.keys(rest).join(', ')}`);
    // LEFT_OUT.menuDescriptions
    if (description !== undefined) left.menuDescriptions.push(title);
    const lead = url === undefined ? {} : target(url, `site.json: the menu's entry ${here}`, null);
    const to = typeof lead === 'string' && lead.startsWith('konzilo:') ? { post: lead.slice('konzilo:'.length) } : url === undefined ? {} : { url: lead };
    return { title, ...to, ...(under ? { items: entries(under, here) } : {}) };
  });
  write('menus/main.json', jsonFile({ items: entries(given.menu.items, 'main') }), 'site.json');
  write('menus/social.json', jsonFile({ items: entries(given.footer.upper.b1.links.map(({ label, href }) => ({ title: label, url: href })), 'social') }), 'site.json');
  // The links under the search box, where site.json gives them.
  const searchLinks = given.header.search?.links ?? [];
  if (searchLinks.length > 0) write('menus/search.json', jsonFile({ items: entries(searchLinks.map(({ label, href }) => ({ title: label, url: href })), 'search') }), 'site.json');

  // The footer's legal links are the legal pages, each by its post's title, as the frame shows them.
  const legalLinks = given.footer.lower.a2.links;
  const legalPages = Object.fromEntries(Object.entries(LEGAL_PAGES).map(([role, address]) => [role, postId(address, `the legal page ${role}`)]));
  const expected = Object.values(LEGAL_PAGES).map((address) => ({ label: postAt.get(address).fields.title, href: address }));
  if (JSON.stringify(legalLinks) !== JSON.stringify(expected)) stop(`site.json: footer.lower.a2.links must be the legal pages, each by its title, ${JSON.stringify(expected)}, since the frame shows the core's legal pages there`);

  // The forms: their fields are site-description.json's, which must be site.json's but for the links in labels.
  const forms = {};
  const plain = (label) => label.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  for (const [name, { confirmation, label, fields, ...rest }] of Object.entries(given.forms)) {
    if (Object.keys(rest).length > 0) stop(`site.json: the form ${name} holds ${Object.keys(rest).join(', ')}`);
    forms[name] = { confirmation };
    const wanted = { label, fields: fields.map((field) => {
      if (plain(field.label) !== field.label) left.labelLinks.push(`${name}.${field.name}`);
      return { ...field, label: plain(field.label) };
    }) };
    const declared = JSON.parse(readFileSync(join(ROOT, 'site-description.json'), 'utf8')).forms?.[name];
    if (JSON.stringify(declared) !== JSON.stringify(wanted)) stop(`site-description.json: the form ${name} is not site.json's, with each link in a label as its words alone: ${JSON.stringify(wanted)}`);
  }
  const declaredForms = Object.keys(JSON.parse(readFileSync(join(ROOT, 'site-description.json'), 'utf8')).forms ?? {});
  const extra = declaredForms.filter((name) => !Object.hasOwn(given.forms, name));
  if (extra.length > 0) stop(`site-description.json declares the forms ${extra.join(', ')}, which site.json has not got`);

  const settings = {
    title: given.title,
    logo: { src: picture(`logo:${IDENTITY.logo}`, 'the site\'s logo'), alt: given.title },
    icon: { src: picture(`logo:${IDENTITY.icon}`, 'the site icon') },
    headerActionLabel: given.header.cta.label,
    headerActionPage: postId(given.header.cta.url, 'site.json: header.cta'),
    headerMenuWord: given.header.menuWord,
    headerSearchWord: given.header.search?.word,
    footerAbout: given.footer.upper.a2.text,
    footerAddress: given.footer.lower.a1.text,
    footerNote: given.footer.lower.b1.text,
    // The words after the cookie policy's declaration, where site.json gives them (design/content/README.md asks for them).
    cookieDeclarationNote: given.cookieDeclaration?.note,
    ...Object.fromEntries(Object.entries(TEMPLATE_WORDS).map(([name, value]) => {
      const setting = site.settings.find((one) => one.name === name) ?? stop(`site-description.json declares no setting ${name}, which TEMPLATE_WORDS gives`);
      return [name, setting.type === 'post' ? postId(value, `TEMPLATE_WORDS.${name}`) : value];
    })),
    search: { description: given.description, publisher: given.publisher },
    metaLine: { types: { article: { format: META_LINE_FORMAT } } },
    legalPages,
    forms,
    notFound: { page: notFound.id },
  };
  write('settings.json', jsonFile(settings), 'site.json');

  for (const [name, file] of originals) {
    mkdirSync(join(out, 'media'), { recursive: true });
    cpSync(file, join(out, 'media', name));
  }

  const live = posts.filter((post) => !left.scheduled.includes(post.path));
  const addresses = new Map(live.filter((post) => !post.notFound).map((post) => [`${post.type.collection}/${post.id}.md`, { path: post.path, address: post.address }]));
  return { left, posts: live, originals: originals.size, addresses, names };
}

async function main() {
  const { values } = parseArgs({ options: { credits: { type: 'boolean' }, force: { type: 'boolean' } } });
  if (values.credits) {
    console.log(JSON.stringify(creditsOfMasters(DEMO), null, 2));
    return;
  }

  if (existsSync(CONTENT) && !sameFiles(CONTENT, DEMO)) {
    console.log(`demo-content: ${CONTENT} is no copy of demo-content/, so the site builds from content of its own; nothing is changed. Remove it to build from the demo content.`);
    return;
  }

  const inputs = inputsDigest();
  const last = existsSync(MADE) ? JSON.parse(readFileSync(MADE, 'utf8')) : null;
  if (!values.force && last?.inputs === inputs && existsSync(DEMO) && last.output === digestOf(DEMO)) {
    console.log('demo-content: nothing it is made from has changed, so demo-content/ stays as it is');
    return;
  }
  rmSync(MADE, { force: true });

  const { readSiteDescription } = await coreModule('src/site-description.js');
  const site = readSiteDescription(join(ROOT, 'site-description.json'));
  const source = join(WORK, 'source');
  const content = join(WORK, 'content');
  rmSync(WORK, { recursive: true, force: true });
  const made = await makeSource(site, source);

  const report = runIntake({ source, content });
  const problems = shortfalls(report, made.names);
  // Each post at the address design/content/ gives it.
  for (const [file, { path, address }] of made.addresses) {
    const post = report.posts.find((one) => one.file === file);
    if (!post) problems.push(`missing: the intake says nothing of ${path}`);
    else if (post.state === 'live' && post.address !== address) problems.push(`moved: ${path} is at ${post.address}, not ${address}`);
  }
  if (report.posts.length !== made.posts.length) problems.push(`the intake read ${report.posts.length} posts, of ${made.posts.length} written`);
  if (problems.length > 0) stop(`the intake did not take the demo content as it is (its folders are kept in ${WORK}):\n  ${problems.join('\n  ')}`);

  // content/ goes first, so that a run cut short here leaves no copy of the old demo content beside the new.
  // The ledger of which post each file is stays out: demo content has no history of builds, as the core's has none.
  rmSync(CONTENT, { recursive: true, force: true });
  replaceWithCopy(content, DEMO, { leaveOut: (path) => path === '.post-ids.json' });
  rmSync(WORK, { recursive: true, force: true });
  writeFileSync(MADE, jsonFile({ inputs, output: digestOf(DEMO) }));

  const files = filesIn(DEMO);
  const masters = files.filter((path) => path.startsWith('media/')).length;
  console.log(`demo-content: ${report.posts.length} posts live (${countsOf(report)}), ${files.length} files, ${masters} masters of ${made.originals} originals; 0 refusals, 0 warnings`);
  const { left } = made;
  console.log(`demo-content: left out: ${left.scheduled.length} scheduled (${left.scheduled.join(', ')}), ${left.menuDescriptions.length} menu descriptions, ${left.labelLinks.length} links in labels (${left.labelLinks.join(', ')}), ${left.modified.length} days of last change; Home stands at /home/ (LEFT_OUT in scripts/demo-content.mjs)`);
}

try {
  await main();
} catch (error) {
  console.error(`demo-content: ${error instanceof Stop ? error.message : error.stack}`);
  process.exit(1);
}
