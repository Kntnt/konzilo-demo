// ::post-list, as the core evaluates it at a build (Konzilo's ADR 0039 and src/post-lists.js) and as the design's
// presentations draw it (directives.md, ::post-list): the published posts of a type in design/content, chosen by
// include, exclude and where, ordered by order and direction, without this post and the posts the lists above it on
// the page showed (leaveOutThis, leaveOutShown), then cut by offset and number, each as a teaser card, a link as a
// whole. A list with `pages="true"` shows its first page, `number` posts, and the core's pager under it (Konzilo's
// Pager.astro, which konzilo.css draws).
//
// Presentations: the design's `cards`, `featured` and `filtered`, and `rows`, the site's own, drawn with Konzilo
// Design's Content Loop as rows (ContentLoop.astro with presentation="rows" and no pictures): each post's metadata
// above and below its heading, its heading as its link, and its summary. It is for posts read by their facts rather
// than their pictures, such as vacancies: a vacancy's office and team above, its employment and last day to apply below.
import { posts, termName } from './content.js';
import { attributes, escapeText, tag } from './html.js';
import { pictureSrc, WIDTHS } from './pictures.js';
import { iconHtml, surfaceOf } from '@kntnt/konzilo-design/directives';
import { filterKeys, itemMatches } from '@kntnt/konzilo-design/components/visitor-filters.js';

const FIELDS = { category: 'category', categories: 'category', topic: 'topics', topics: 'topics', author: 'authors', authors: 'authors' };
const COLLECTIONS = { category: 'categories', topics: 'topics', authors: 'authors' };
const valuesOf = (post, field) => [].concat(post.data[field] ?? []).map(String);

// The moment the mockups are built at. A post dated later is scheduled, and a build writes no such post (editorial.md,
// The scheduled article), so no list, related reading or term page shows it.
export const NOW = Date.now();
export const isPublished = (post) => !post.data.date || new Date(post.data.date).getTime() <= NOW;
export const publishedPosts = (type) => posts().filter((post) => (!type || post.type === type) && isPublished(post));

// include="category:guides topics:solar,storage": each taxonomy apart by a space, its slugs by commas.
function termsMatch(post, filter, every) {
  const groups = String(filter).trim().split(/\s+/).filter(Boolean).map((group) => {
    const [taxonomy, slugs = ''] = group.split(':');
    const field = FIELDS[taxonomy] ?? taxonomy;
    return slugs.split(',').some((slug) => valuesOf(post, field).includes(slug));
  });
  return every ? groups.every(Boolean) : groups.some(Boolean);
}

// where="featured=true;industry!=retail": conditions on fields, apart by semicolons. A post without a value for the
// field meets no condition on it but `!=`.
function whereMatch(post, where) {
  return String(where).split(';').filter(Boolean).every((condition) => {
    const [, field, op, value] = /^\s*([\w-]+)\s*(!=|<=|>=|=|<|>)\s*(.*?)\s*$/.exec(condition) ?? [];
    if (!field) return true;
    const actual = post.data[field];
    if (actual === undefined || actual === null || actual === '') return op === '!=';
    const text = Array.isArray(actual) ? actual.map(String) : [actual instanceof Date ? actual.toISOString().slice(0, 10) : String(actual)];
    if (op === '=') return text.includes(value);
    if (op === '!=') return !text.includes(value);
    const [left, right] = [Number(actual) || text[0], Number(value) || value];
    return op === '<' ? left < right : op === '>' ? left > right : op === '<=' ? left <= right : left >= right;
  });
}

const dateOf = (post) => new Date(post.data.date ?? 0).getTime();
const byTitle = (a, b) => String(a.data.title).localeCompare(String(b.data.title), 'en-GB', { numeric: true }) || a.slug.localeCompare(b.slug);

// What a post shares with this one, as the core ranks related posts (ADR 0070, without the freshness, which halves
// every post's score alike over time and so changes no order of dated posts): in a list of articles a point for each
// shared topic and half a point for the same category; in a list of another type a point for each shared term.
function sharedWith(current, other) {
  if (!current) return 0;
  const shared = (field) => valuesOf(other, field).filter((slug) => valuesOf(current, field).includes(slug)).length;
  if (other.type === 'article') return shared('topics') + shared('category') * 0.5;
  return shared('topics') + shared('category') + shared('authors');
}

// Every post a list shows on any page, in order: filtered, ordered, without this post and the posts shown above, from
// its offset.
function matches(attrs, current, shown = new Set()) {
  let found = publishedPosts(attrs.type);
  if (attrs.include) found = found.filter((post) => termsMatch(post, attrs.include, true));
  if (attrs.exclude) found = found.filter((post) => !termsMatch(post, attrs.exclude, false));
  if (attrs.where) found = found.filter((post) => whereMatch(post, attrs.where));
  const order = attrs.order ?? (found.some((post) => post.data.date) ? 'date' : 'title');
  if (order === 'related') {
    found = found.map((post) => ({ post, score: sharedWith(current, post) })).filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || dateOf(b.post) - dateOf(a.post) || byTitle(a.post, b.post)).map(({ post }) => post);
  } else {
    const sign = (attrs.direction ?? (order === 'date' || order === 'modified' ? 'descending' : 'ascending')).startsWith('asc') ? 1 : -1;
    // Any other field orders by its value, as the core's evaluator does: a boolean as 0 or 1, a missing value last,
    // and ties by title.
    const keyOf = (post) => {
      if (order === 'date') return dateOf(post);
      const value = post.data[order];
      return typeof value === 'boolean' ? Number(value) : value instanceof Date ? value.getTime() : value ?? null;
    };
    found.sort((a, b) => {
      if (order === 'title') return sign * byTitle(a, b);
      const [x, y] = [keyOf(a), keyOf(b)];
      if (x === null || y === null) return x === y ? byTitle(a, b) : x === null ? 1 : -1;
      return sign * (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) || byTitle(a, b);
    });
  }
  if (attrs.leaveOutThis !== 'false' && current) found = found.filter((post) => post.file !== current.file);
  if (attrs.leaveOutShown !== 'false') found = found.filter((post) => !shown.has(post.file));
  return found.slice(Number(attrs.offset ?? 0));
}

// The posts a list shows on one page of it, from 1, with `pages`, how many pages it has at `number` a page.
export function chosenPosts(attrs, current, { shown, page = 1 } = {}) {
  const number = Math.min(100, Math.max(1, Number(attrs.number ?? 10)));
  const all = matches(attrs, current, shown);
  return Object.assign(all.slice((page - 1) * number, page * number), { pages: Math.max(1, Math.ceil(all.length / number)) });
}

// Related posts of the post's own type, as the recommended reading under a post ranks them.
export const relatedPosts = (post, number = 3) => chosenPosts({ type: post.type, order: 'related', number }, post);

// What a post shows of itself elsewhere: its teaser, with the featured image and the headline behind it, and its
// summary, as the core's ownSummary() gives it: its excerpt, else its teaser's text, else its standfirst. The label
// over the headline is the post's category; a case study, which has none, shows its customer there.
export function teaserOf(post) {
  const teaser = post.data.teaser ?? {};
  const picture = teaser.image ?? post.data.image;
  const category = valuesOf(post, 'category')[0];
  return {
    post,
    href: post.address ?? `/${post.file.replace(/\.md$/, '').replace(/(^|\/)index$/, '')}/`,
    headline: teaser.headline ?? post.data.headline ?? post.data.title,
    text: post.data.excerpt ?? teaser.text ?? post.data.standfirst ?? post.data.description,
    picture: picture ? { src: typeof picture === 'string' ? picture : picture.src, alt: typeof picture === 'string' ? '' : picture.alt ?? '' } : null,
    label: category ? termName(COLLECTIONS.category, category) : post.data.customer ?? post.data.eyebrow,
    topics: valuesOf(post, 'topics'),
  };
}

// A teaser card (directives.md, ::post-list).
export function teaserCard(teaser, ctx, { type = 'heading-5', width = WIDTHS.card, extra = {} } = {}) {
  return tag('article', { class: 'kn-card', 'data-kn-surface': surfaceOf('link-card', ctx.ground), ...extra },
    teaser.picture ? `<img${attributes({ class: 'kn-card-picture', src: pictureSrc(teaser.picture.src, width), alt: teaser.picture.alt })}>` : '',
    teaser.label ? tag('p', { class: 'kn-card-eyebrow', 'data-kn-type': 'label' }, escapeText(teaser.label)) : '',
    tag('h3', { class: 'kn-card-heading', 'data-kn-type': type }, tag('a', { class: 'kn-card-link', href: teaser.href }, escapeText(teaser.headline ?? ''))),
    teaser.text ? tag('p', { class: 'kn-card-text', 'data-kn-type': 'small' }, escapeText(teaser.text)) : '');
}

// ---------- rows ----------

export const longDate = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
export const isoDay = (value) => new Date(value).toISOString().slice(0, 10);

// Content Metadata (ContentMetadata.astro): label text, its items apart by the design's separator, each with an
// address, a moment or the pill's look where it has one.
export function contentMetadata(items, place, separator = 'dot') {
  if (!items.length) return '';
  return tag('p', { class: 'kn-content-meta', 'data-kn-type': 'label', 'data-kn-meta': place, 'data-kn-separator': separator },
    items.map((item) => {
      const words = item.datetime ? tag('time', { datetime: item.datetime }, escapeText(item.text)) : escapeText(item.text);
      return tag('span', { class: item.pill ? 'kn-content-meta-item kn-pill' : 'kn-content-meta-item', 'data-kn-pill': item.pill ? 'true' : undefined },
        item.href ? tag('a', { href: item.href }, words) : words);
    }));
}

// A row's metadata above its heading and below it: a vacancy's office and team, then its employment and its last day to
// apply; an article's category, then its date and authors; a case study's customer, then its industry.
function metaOf(post) {
  const { data } = post;
  if (post.type === 'job') {
    return {
      above: [data.location, data.team].filter(Boolean).map((text) => ({ text })),
      below: [data.employment && { text: data.employment }, data.closingDate && { text: `Apply by ${longDate(data.closingDate)}`, datetime: isoDay(data.closingDate) }].filter(Boolean),
    };
  }
  if (post.type === 'case-study') return { above: data.customer ? [{ text: data.customer }] : [], below: data.industry ? [{ text: data.industry }] : [] };
  const category = valuesOf(post, 'category')[0];
  return {
    above: category ? [{ text: termName('categories', category), href: `/insights/category/${category}/` }] : [],
    below: [data.date && { text: longDate(data.date), datetime: isoDay(data.date) }, ...valuesOf(post, 'authors').map((slug) => ({ text: termName('authors', slug), href: `/insights/author/${slug}/` }))].filter(Boolean),
  };
}

// A Content Row without a picture (ContentRow.astro, images={false}).
function contentRow(teaser) {
  const { above, below } = metaOf(teaser.post);
  return tag('article', { class: 'kn-content-row', 'data-kn-image-ratio': '3:2' },
    tag('div', { class: 'kn-content-body' },
      contentMetadata(above, 1),
      tag('h3', { class: 'kn-content-heading', 'data-kn-type': 'heading-5' }, tag('a', { class: 'kn-content-link', href: teaser.href }, escapeText(teaser.post.data.headline ?? teaser.post.data.title))),
      contentMetadata(below, 2),
      teaser.text ? tag('p', { class: 'kn-content-text', 'data-kn-type': 'small' }, escapeText(teaser.text)) : ''));
}

// ---------- the pager ----------

// The core's pager on page `current` of `count` (Konzilo's Pager.astro and pagerOf()): every page up to seven, else the
// first, the last and the two on either side of the current one; page 1 at the post's address, the others at
// <address>page/<n>/. A list that fills one page has none.
export function pager(address, current, count) {
  if (count < 2) return '';
  const url = (n) => (n === 1 ? address : `${address}page/${n}/`);
  const shown = Array.from({ length: count }, (_, i) => i + 1).filter((n) => count <= 7 || n === 1 || n === count || Math.abs(n - current) <= 2);
  const items = [];
  shown.forEach((n, i) => {
    if (i > 0 && n - shown[i - 1] > 1) items.push('<li class="konzilo-pager-gap" aria-hidden="true">…</li>');
    items.push(tag('li', {}, tag('a', { href: url(n), 'aria-label': `Page ${n}`, 'aria-current': n === current ? 'page' : undefined }, String(n))));
  });
  return tag('nav', { class: 'konzilo-pager', 'aria-label': 'Pages' }, tag('ul', {},
    current > 1 ? tag('li', { class: 'konzilo-pager-previous' }, tag('a', { href: url(current - 1), rel: 'prev' }, 'Previous page')) : '',
    items,
    current < count ? tag('li', { class: 'konzilo-pager-next' }, tag('a', { href: url(current + 1), rel: 'next' }, 'Next page')) : ''));
}

// ---------- the presentations ----------

const PLURAL = { article: 'articles', 'case-study': 'case studies', job: 'vacancies', page: 'pages' };

// The posts the lists of a page have shown, shared by every list on it through the page's ids (Markdown.astro).
const shownOn = new WeakMap();
function shownFor(ctx) {
  const key = ctx.ids ?? ctx;
  if (!shownOn.has(key)) shownOn.set(key, new Set());
  return shownOn.get(key);
}

// ---------- filtered ----------

// The rows a filtered list can have, in the fixed order a site writes them whatever order they are given in
// (directives.md, `filtered`): each taxonomy a row of pills, by its query key, its legend and the teaser's field, and
// search last. A list placed with no rows chosen has one row of topics.
const ROWS = [
  { name: 'category', key: 'category', legend: 'Category', field: 'category' },
  { name: 'topics', key: 'topic', legend: 'Topic', field: 'topics' },
];
const SEARCH = { label: 'Search', button: 'Search', show: 'Show', action: '/search/' };

// The attribute that chooses the rows, `filters="category topics search"`, is the design's proposal; the core has none
// yet (directives.md, Open questions). `settled` is what the page itself settles, { key, value } by the query key, such as the category
// on a category's page: its row is left out and a search sends it as a hidden field.
function filtered(teasers, ctx, { type, pagerHtml, filters, settled, total, all }) {
  const asked = new Set(String(filters ?? 'topics').split(/\s+/).filter(Boolean));
  const id = `posts-${(ctx.ids.posts = (ctx.ids.posts ?? 0) + 1)}`;
  // Each row's terms are those of the posts the list holds, on every page, the terms with the most posts first, at most 24.
  const rows = ROWS.filter((row) => asked.has(row.name) && row.key !== settled?.key).map((row) => {
    const counts = new Map();
    for (const teaser of all) for (const slug of valuesOf(teaser.post, row.field)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    const slugs = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b)).slice(0, 24);
    return { ...row, options: slugs.map((slug) => ({ value: slug, label: termName(COLLECTIONS[row.field] ?? row.field, slug) })) };
  }).filter((row) => row.options.length);
  const search = asked.has('search');
  const keys = filterKeys(rows.map((row) => ({ name: row.key, options: row.options })));
  const hidden = search ? Object.fromEntries(Object.entries({ type, ...(settled ? { [settled.key]: settled.value } : {}) }).filter(([, value]) => value)) : {};
  const noun = PLURAL[type] ?? 'posts';
  const count = total > teasers.length ? `Showing ${teasers.length} of ${total} ${noun}` : `Showing ${teasers.length} ${noun}`;
  return tag('div', { class: 'kn-post-list', 'data-kn-presentation': 'filtered' },
    tag('form', { class: 'kn-visitor-filters', role: 'search', method: 'get', action: search ? SEARCH.action : '' },
      Object.entries(hidden).map(([key, value]) => `<input${attributes({ type: 'hidden', name: key, value })}>`),
      tag('div', { class: 'kn-visitor-filter-panel' },
        rows.map((row) => tag('fieldset', { class: 'kn-visitor-filter-group' }, `<legend>${escapeText(row.legend)}</legend>`,
          tag('div', { class: 'kn-visitor-filter-toggles' }, row.options.map((option) => tag('label', { class: 'kn-pill' },
            `<input${attributes({ type: 'checkbox', name: row.key, value: option.value, 'aria-controls': id, 'data-kn-match': keys.get(row.key).get(option.value) })}>`, escapeText(option.label)))))),
        search ? tag('div', { class: 'kn-field kn-visitor-filter-search' },
          tag('label', { class: 'kn-field-label', for: `${id}-search` }, SEARCH.label),
          tag('div', { class: 'kn-visitor-filter-input' }, iconHtml('search'), `<input${attributes({ class: 'kn-field-control', id: `${id}-search`, name: 'q', type: 'search' })}>`)) : '',
        tag('button', { class: 'kn-button kn-visitor-filter-submit', type: 'submit', 'data-kn-variant': 'outline' }, search ? SEARCH.button : SEARCH.show)),
      tag('p', { class: 'kn-visitor-filter-count', 'data-kn-type': 'small' }, count)),
    tag('div', { class: 'kn-card-grid kn-cards', id }, teasers.map((teaser) => teaserCard(teaser, ctx, {
      extra: { 'data-kn-item': '', 'data-kn-matches': itemMatches(keys, Object.fromEntries(rows.map((row) => [row.key, valuesOf(teaser.post, row.field)]))) || undefined },
    }))), pagerHtml);
}

// Teasers as a presentation draws them, with the pager, where there is one, after them, as the core's presentations
// place it.
export function presentation(name, teasers, ctx, { type, pagerHtml = '', filters, settled, total = teasers.length, all = teasers } = {}) {
  if (name === 'featured') {
    return tag('div', { class: 'kn-post-list', 'data-kn-presentation': 'featured' }, tag('div', { class: 'kn-featured' },
      teasers.map((teaser, index) => teaserCard(teaser, ctx, index === 0 ? { type: 'heading-3', width: WIDTHS.section } : {}))), pagerHtml);
  }
  if (name === 'filtered') return filtered(teasers, ctx, { type, pagerHtml, filters, settled, total, all });
  if (name === 'rows') {
    return tag('div', { class: 'kn-post-list', 'data-kn-presentation': 'rows' },
      tag('div', { class: 'kn-content-loop', 'data-kn-presentation': 'rows' },
        tag('ul', { class: 'kn-content-items kn-content-rows', 'data-kn-columns': '3', role: 'list' },
          teasers.map((teaser) => tag('li', { class: 'kn-content-item' }, contentRow(teaser))))),
      pagerHtml);
  }
  if (name !== 'cards') ctx.warn(`the post list presentation ${name} is not one the design draws; drawn as cards`);
  return tag('div', { class: 'kn-post-list', 'data-kn-presentation': 'cards' }, tag('div', { class: 'kn-card-grid kn-cards' }, teasers.map((teaser) => teaserCard(teaser, ctx))), pagerHtml);
}

export function postList(attrs, ctx) {
  const shown = shownFor(ctx);
  const every = attrs.pages === 'true' ? chosenPosts({ ...attrs, number: 100 }, ctx.post, { shown }) : null;
  const chosen = chosenPosts(attrs, ctx.post, { shown });
  for (const post of chosen) shown.add(post.file);
  if (chosen.length === 0) return attrs.empty ? tag('p', {}, escapeText(attrs.empty)) : '';
  const pagerHtml = attrs.pages === 'true' ? pager(ctx.address ?? '/', 1, chosen.pages) : '';
  return presentation(attrs.presentation ?? 'cards', chosen.map(teaserOf), ctx, {
    type: attrs.type, pagerHtml, filters: attrs.filters, total: every?.length ?? chosen.length, all: (every ?? chosen).map(teaserOf),
  });
}
