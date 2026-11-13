#!/usr/bin/env node
// Makes demo-content/, the site's published demo content (Konzilo's ADR 0025), from the design: the texts in
// design/content/, the pictures in design/images/ and the logos in design/logo/. design/content/ stays the one
// place a text is written. This script writes it as source files, as an editor's saves would leave them, and the
// core's own intake command makes the content files from them, so that demo-content/ holds exactly what the core
// would publish. It stops, writing nothing, at any refusal or warning of the intake, at any post that is not
// live, but one dated after the moment the content is made at, which waits for its date as a scheduled post, and at
// anything in design/content/ it does not know how to carry over. A scheduled post's file is the one the intake
// writes once its moment has come; demo-content/ holds it, and a build leaves it out until then.
//
//   node scripts/demo-content.mjs            make demo-content/ again, and remove content/ if it was a copy
//   node scripts/demo-content.mjs --force    the same, even where nothing it is made from has changed
//   node scripts/demo-content.mjs --credits  print each master in demo-content/ with its picture's credit, as JSON
//
// The same design always gives the same bytes: the intake runs at a fixed moment, DEMO_MOMENT in
// scripts/lib/intake.mjs, and for a scheduled post's file at a fixed moment after its date. So where nothing it is
// made from has changed since it last made demo-content/, and demo-content/ is as it made it, the script leaves both
// as they are: what it is made from is design/content/, design/images/, design/logo/, the design file,
// site-description.json, these scripts, package-lock.json, which pins the core and Konzilo Design by their tarballs
// in vendor/, and the core's own code as installed (INPUTS).
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
import { digestOf, filesIn, replaceWithCopy } from './lib/files.mjs';
import { coreModule, countsOf, DEMO_MOMENT, ROOT, runIntake, shortfalls } from './lib/intake.mjs';
import { searchTexts } from '../src/lib/search-texts.js';

// What the core cannot hold, and so is left out of the demo content, each with what it waits for. To put one back, delete its entry and the code that names it (`LEFT_OUT.<name>`).
export const LEFT_OUT = {
  modified: {
    what: 'A post\'s own day of last change, `modified` in design/content/; each post\'s is its date.',
    waits: 'Nothing that is planned: the core derives `modified` from the post\'s history, and no source file sets it (src/intake/post-file.js:3).',
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

// The meta line of an article (design/README.md, "Rules the design keeps").
const META_LINE_FORMAT = 'By {authors} • Published {date} in {category}';

// The words the templates show that no post holds, `templates` in design/content/site.json, as the settings of the
// site's own that hold them (site-description.json): each text as it is, and each link as its words and the post at
// its address, set by the post's ID, with the section it leads to, after #, where a setting holds it.
function templateSettings(templates, postId) {
  const words = (value, where) => (typeof value === 'string' && value.trim() !== '' ? value : stop(`site.json: templates.${where} is no text`));
  const page = (link, where) => postId(words(link?.href, `${where}.href`).split('#')[0], `site.json: templates.${where}`);
  const { article, caseStudy, vacancy, termPage } = templates ?? stop('site.json: has no templates, the words the templates show');
  const [main, other] = caseStudy?.closing?.actions ?? [];
  return {
    articleMoreLabel: words(article?.more?.label, 'article.more.label'),
    articleMorePage: page(article?.more, 'article.more'),
    caseStudyFactsHeading: words(caseStudy?.factsHeading, 'caseStudy.factsHeading'),
    caseStudyMoreHeading: words(caseStudy?.moreHeading, 'caseStudy.moreHeading'),
    caseStudyMoreLabel: words(caseStudy?.more?.label, 'caseStudy.more.label'),
    caseStudyMorePage: page(caseStudy?.more, 'caseStudy.more'),
    caseStudyClosingHeading: words(caseStudy?.closing?.heading, 'caseStudy.closing.heading'),
    caseStudyClosingText: words(caseStudy?.closing?.text, 'caseStudy.closing.text'),
    caseStudyClosingAction: words(main?.label, 'caseStudy.closing.actions.1.label'),
    caseStudyClosingActionPage: page(main, 'caseStudy.closing.actions.1'),
    caseStudyClosingOtherAction: words(other?.label, 'caseStudy.closing.actions.2.label'),
    caseStudyClosingOtherActionPage: page(other, 'caseStudy.closing.actions.2'),
    vacancyApplyLabel: words(vacancy?.apply, 'vacancy.apply'),
    vacancyApplyBy: words(vacancy?.applyBy, 'vacancy.applyBy'),
    vacancyMenuLabel: words(vacancy?.menuLabel, 'vacancy.menuLabel'),
    vacancyOthersHeading: words(vacancy?.othersHeading, 'vacancy.othersHeading'),
    vacancyAllLabel: words(vacancy?.all?.label, 'vacancy.all.label'),
    vacancyAllPage: page(vacancy?.all, 'vacancy.all'),
    vacancyAllAnchor: vacancy.all.href.split('#')[1],
    termNewsletterHeading: words(termPage?.newsletter?.heading, 'termPage.newsletter.heading'),
    termNewsletterText: words(termPage?.newsletter?.text, 'termPage.newsletter.text'),
    termNewsletterNote: words(termPage?.newsletter?.note, 'termPage.newsletter.note'),
  };
}


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
// package-lock.json stands for the packages, the core and Konzilo Design, whose intake and directive checks run; the
// core's own code is read too, which an install without saving, such as of a pack of an unreleased core, changes
// while the lock stays as it was.
const INPUTS = ['design/content', 'design/images', 'design/logo', 'design/site.design.json', 'site-description.json', 'scripts/demo-content.mjs', 'scripts/lib', 'package-lock.json', 'node_modules/@kntnt/konzilo/src'];

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
  const left = { modified: [] };

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
      // The start page: a page of its own slug, which the settings choose (startPage), and which the site shows at /
      // and at no other address.
      if (path !== 'pages/index.md') stop(`${path}: the page at / is pages/index.md`);
      place = 'home';
      address = '/';
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
    const date = fields.date ?? (type.name === 'page' || type.name === 'canvas' ? DEMO_MOMENT : stop(`${path}: a ${type.name} has its date`));
    // A post dated after the moment the content is made at is scheduled for its date, as an editor's save of it says;
    // every other post is published.
    post.scheduled = new Date(date) > new Date(DEMO_MOMENT) ? date : null;
    written.status = post.scheduled ? 'scheduled' : 'published';
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
  const known = ['title', 'description', 'publisher', 'header', 'menu', 'footer', 'forms', 'cookieDeclaration', 'templates', ...FRAME_ONLY.filter((one) => !one.includes('.'))];
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
    const lead = url === undefined ? {} : target(url, `site.json: the menu's entry ${here}`, null);
    const to = typeof lead === 'string' && lead.startsWith('konzilo:') ? { post: lead.slice('konzilo:'.length) } : url === undefined ? {} : { url: lead };
    // The line under the entry, as the large menu shows it.
    return { title, ...to, ...(description !== undefined ? { description } : {}), ...(under ? { items: entries(under, here) } : {}) };
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

  // The forms: their label, fields and own button text, where it gives one, are site-description.json's, which must be
  // site.json's, a link in a field's label written as Markdown, as both take it; the confirmations are settings.
  const forms = {};
  for (const [name, { confirmation, label, fields, button, editable, ...rest }] of Object.entries(given.forms)) {
    if (Object.keys(rest).length > 0) stop(`site.json: the form ${name} holds ${Object.keys(rest).join(', ')}`);
    forms[name] = { confirmation };
    const wanted = { label, fields, ...(button !== undefined ? { button } : {}), ...(editable !== undefined ? { editable } : {}) };
    const declared = JSON.parse(readFileSync(join(ROOT, 'site-description.json'), 'utf8')).forms?.[name];
    if (JSON.stringify(declared) !== JSON.stringify(wanted)) stop(`site-description.json: the form ${name} is not site.json's: ${JSON.stringify(wanted)}`);
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
    ...templateSettings(given.templates, postId),
    search: { description: given.description, publisher: given.publisher },
    metaLine: { types: { article: { format: META_LINE_FORMAT } } },
    legalPages,
    forms,
    notFound: { page: notFound.id },
    startPage: { page: postId('/', 'the start page, pages/index.md') },
  };
  write('settings.json', jsonFile(settings), 'site.json');

  for (const [name, file] of originals) {
    mkdirSync(join(out, 'media'), { recursive: true });
    cpSync(file, join(out, 'media', name));
  }

  const addresses = new Map(posts.filter((post) => !post.notFound).map((post) => [`${post.type.collection}/${post.id}.md`, { path: post.path, address: post.address }]));
  return { left, posts, scheduled: posts.filter((post) => post.scheduled), originals: originals.size, addresses, names };
}

// Whether content/ is a copy of the demo content, as a build fills it: every file of it as demo-content/ holds it, and
// every file of demo-content/ there but a post dated after now, which the core's konzilo-demo-content leaves out until
// its moment.
function isDemoCopy() {
  if (!existsSync(DEMO)) return false;
  const [inContent, inDemo] = [filesIn(CONTENT), filesIn(DEMO)];
  const held = new Set(inContent);
  if (!inContent.every((path) => inDemo.includes(path) && readFileSync(join(CONTENT, path)).equals(readFileSync(join(DEMO, path))))) return false;
  const ahead = (path) => path.endsWith('.md') && new Date(/^date: (\S+)$/m.exec(readFileSync(join(DEMO, path), 'utf8'))?.[1] ?? 0) > new Date();
  return inDemo.every((path) => held.has(path) || ahead(path));
}

async function main() {
  const { values } = parseArgs({ options: { credits: { type: 'boolean' }, force: { type: 'boolean' } } });
  if (values.credits) {
    console.log(JSON.stringify(creditsOfMasters(DEMO), null, 2));
    return;
  }

  if (existsSync(CONTENT) && !isDemoCopy()) {
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
  const sourceFile = (post) => `${post.type.collection}/${post.id}.md`;

  // The demo content, as the intake writes it at the moment the content is made at: every post live but the scheduled
  // ones, which wait for their moments and have no file yet.
  const report = runIntake({ source, content });
  const problems = shortfalls(report, made.names, { waiting: made.scheduled.map((post) => ({ file: sourceFile(post), at: post.scheduled })) });
  // Each post at the address design/content/ gives it.
  for (const [file, { path, address }] of made.addresses) {
    const post = report.posts.find((one) => one.file === file);
    if (!post) problems.push(`missing: the intake says nothing of ${path}`);
    else if (post.state === 'live' && post.address !== address) problems.push(`moved: ${path} is at ${post.address}, not ${address}`);
  }
  if (report.posts.length !== made.posts.length) problems.push(`the intake read ${report.posts.length} posts, of ${made.posts.length} written`);

  // The file of each scheduled post, as the intake writes it once its moment has come: the intake run again after every
  // date the posts hold, which publishes each scheduled post at once, with its own date, and says that its moment had
  // passed, the one warning expected of it. The file, and the masters it names, join the demo content, from which
  // Compose's seed makes the post scheduled again, and which a build leaves out of the content it fills (the core's
  // konzilo-demo-content) until its moment.
  if (made.scheduled.length > 0) {
    const later = new Date(Math.max(...made.scheduled.map((post) => new Date(post.scheduled).valueOf())) + 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const ahead = join(WORK, 'ahead');
    const second = runIntake({ source, content: ahead, moment: later });
    problems.push(...shortfalls(second, made.names, { passed: made.scheduled.map(sourceFile) }).map((line) => `at ${later}: ${line}`));
    for (const post of made.scheduled) {
      const found = second.posts.find((one) => one.file === sourceFile(post));
      if (found?.state === 'live' && found.address !== post.address) problems.push(`moved: ${post.path} is at ${found.address}, not ${post.address}`);
      const file = `${post.type.collection}/${post.place}.md`;
      if (existsSync(join(content, file))) problems.push(`${post.path}: the intake wrote ${file} at ${DEMO_MOMENT}, before its moment, ${post.scheduled}`);
      if (!existsSync(join(ahead, file))) {
        problems.push(`${post.path}: the intake wrote no ${file} at ${later}`);
        continue;
      }
      cpSync(join(ahead, file), join(content, file));
      for (const [, name] of readFileSync(join(ahead, file), 'utf8').matchAll(/media\/([^)\s"'\\]+)/g)) {
        if (!existsSync(join(content, 'media', name))) cpSync(join(ahead, 'media', name), join(content, 'media', name));
      }
    }
  }
  if (problems.length > 0) stop(`the intake did not take the demo content as it is (its folders are kept in ${WORK}):\n  ${problems.join('\n  ')}`);

  // content/ goes first, so that a run cut short here leaves no copy of the old demo content beside the new.
  // The ledger of which post each file is stays out: demo content has no history of builds, as the core's has none.
  rmSync(CONTENT, { recursive: true, force: true });
  replaceWithCopy(content, DEMO, { leaveOut: (path) => path === '.post-ids.json' });
  rmSync(WORK, { recursive: true, force: true });
  writeFileSync(MADE, jsonFile({ inputs, output: digestOf(DEMO) }));

  const files = filesIn(DEMO);
  const masters = files.filter((path) => path.startsWith('media/')).length;
  const live = report.posts.filter((post) => post.state === 'live').length;
  const scheduled = made.scheduled.map((post) => `${post.path}, for ${post.scheduled}`).join('; ');
  console.log(`demo-content: ${live} posts live (${countsOf(report)})${scheduled ? `, ${made.scheduled.length} scheduled (${scheduled})` : ''}, ${files.length} files, ${masters} masters of ${made.originals} originals; 0 refusals, 0 warnings`);
  const { left } = made;
  console.log(`demo-content: left out: ${left.modified.length} days of last change (LEFT_OUT in scripts/demo-content.mjs)`);
}

try {
  await main();
} catch (error) {
  console.error(`demo-content: ${error instanceof Stop ? error.message : error.stack}`);
  process.exit(1);
}
