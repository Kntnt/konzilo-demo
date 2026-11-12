// ::post-list, as the core evaluates it at a build (Konzilo's ADR 0039) and as the design's presentations draw it
// (directives.md, ::post-list): the posts of a type in design/content, chosen by include, exclude and where, ordered
// and cut by order, direction, offset and number, each as a teaser card, a link as a whole.
import { termName } from './content.js';
import { posts } from './content.js';
import { attributes, escapeText, tag } from './html.js';
import { pictureSrc, WIDTHS } from './pictures.js';
import { surfaceOf } from '@kntnt/konzilo-design/directives';

const FIELDS = { category: 'category', categories: 'category', topic: 'topics', topics: 'topics', author: 'authors', authors: 'authors' };
const COLLECTIONS = { category: 'categories', topics: 'topics', authors: 'authors' };
const valuesOf = (post, field) => [].concat(post.data[field] ?? []).map(String);

// include="category:guides topics:solar,storage": each taxonomy apart by a space, its slugs by commas.
function termsMatch(post, filter, every) {
  const groups = String(filter).trim().split(/\s+/).filter(Boolean).map((group) => {
    const [taxonomy, slugs = ''] = group.split(':');
    const field = FIELDS[taxonomy] ?? taxonomy;
    return slugs.split(',').some((slug) => valuesOf(post, field).includes(slug));
  });
  return every ? groups.every(Boolean) : groups.some(Boolean);
}

// where="featured=true;industry!=retail": conditions on fields, apart by semicolons.
function whereMatch(post, where) {
  return String(where).split(';').filter(Boolean).every((condition) => {
    const [, field, op, value] = /^\s*([\w-]+)\s*(!=|<=|>=|=|<|>)\s*(.*?)\s*$/.exec(condition) ?? [];
    if (!field) return true;
    const actual = post.data[field];
    const text = Array.isArray(actual) ? actual.map(String) : [String(actual)];
    if (op === '=') return text.includes(value);
    if (op === '!=') return !text.includes(value);
    const [left, right] = [Number(actual) || String(actual ?? ''), Number(value) || value];
    return op === '<' ? left < right : op === '>' ? left > right : op === '<=' ? left <= right : left >= right;
  });
}

const dateOf = (post) => new Date(post.data.date ?? 0).getTime();

export function chosenPosts(attrs, current) {
  let found = posts().filter((post) => post.type === attrs.type);
  if (attrs.include) found = found.filter((post) => termsMatch(post, attrs.include, true));
  if (attrs.exclude) found = found.filter((post) => !termsMatch(post, attrs.exclude, false));
  if (attrs.where) found = found.filter((post) => whereMatch(post, attrs.where));
  if (attrs.leaveOutThis !== 'false' && current) found = found.filter((post) => post.file !== current.file);
  const order = attrs.order ?? 'date';
  const sign = (attrs.direction ?? (order === 'title' ? 'ascending' : 'descending')).startsWith('asc') ? 1 : -1;
  found.sort(order === 'title' ? (a, b) => sign * String(a.data.title).localeCompare(String(b.data.title)) : (a, b) => sign * (dateOf(a) - dateOf(b)));
  const offset = Number(attrs.offset ?? 0);
  return found.slice(offset, offset + Number(attrs.number ?? 10));
}

// What a post shows of itself elsewhere: its teaser, with the featured image, headline and standfirst behind it.
export function teaserOf(post) {
  const teaser = post.data.teaser ?? {};
  const picture = teaser.image ?? post.data.image;
  const category = valuesOf(post, 'category')[0];
  return {
    href: post.address ?? `/${post.file.replace(/\.md$/, '').replace(/(^|\/)index$/, '')}/`,
    headline: teaser.headline ?? post.data.headline ?? post.data.title,
    text: teaser.text ?? post.data.standfirst ?? post.data.description ?? post.data.excerpt,
    picture: picture ? { src: typeof picture === 'string' ? picture : picture.src, alt: typeof picture === 'string' ? '' : picture.alt ?? '' } : null,
    label: category ? termName(COLLECTIONS.category, category) : post.data.eyebrow,
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

const PLURAL = { article: 'articles', 'case-study': 'case studies', job: 'vacancies', page: 'pages' };

export function postList(attrs, ctx) {
  const chosen = chosenPosts(attrs, ctx.post).map(teaserOf);
  const presentation = attrs.presentation ?? 'cards';
  if (chosen.length === 0) return attrs.empty ? tag('p', {}, escapeText(attrs.empty)) : '';
  if (presentation === 'featured') {
    return tag('div', { class: 'kn-post-list', 'data-kn-presentation': 'featured' }, tag('div', { class: 'kn-featured' },
      chosen.map((teaser, index) => teaserCard(teaser, ctx, index === 0 ? { type: 'heading-3', width: WIDTHS.section } : {}))));
  }
  if (presentation === 'filtered') {
    // The topics with the most posts first, at most 24; a pill's key is 1- and its place (directives.md, `filtered`).
    const counts = new Map();
    for (const teaser of chosen) for (const topic of teaser.topics) counts.set(topic, (counts.get(topic) ?? 0) + 1);
    const topics = [...counts.keys()].sort((a, b) => counts.get(b) - counts.get(a) || a.localeCompare(b)).slice(0, 24);
    const id = `posts-${(ctx.ids.posts = (ctx.ids.posts ?? 0) + 1)}`;
    return tag('div', { class: 'kn-post-list', 'data-kn-presentation': 'filtered' },
      tag('form', { class: 'kn-visitor-filters', role: 'search', method: 'get', action: '' },
        tag('div', { class: 'kn-visitor-filter-panel' },
          tag('fieldset', { class: 'kn-visitor-filter-group' }, '<legend>Topic</legend>',
            tag('div', { class: 'kn-visitor-filter-toggles' }, topics.map((topic, index) => tag('label', { class: 'kn-pill' },
              `<input${attributes({ type: 'checkbox', name: 'topic', value: topic, 'aria-controls': id, 'data-kn-match': `1-${index + 1}` })}>`, escapeText(termName('topics', topic)))))),
          tag('button', { class: 'kn-button kn-visitor-filter-submit', type: 'submit', 'data-kn-variant': 'outline' }, 'Show')),
        tag('p', { class: 'kn-visitor-filter-count', 'data-kn-type': 'small' }, `Showing ${chosen.length} ${PLURAL[attrs.type] ?? 'posts'}`)),
      tag('div', { class: 'kn-card-grid kn-cards', id }, chosen.map((teaser) => teaserCard(teaser, ctx, {
        extra: { 'data-kn-item': '', 'data-kn-matches': topics.flatMap((topic, index) => (teaser.topics.includes(topic) ? [`1-${index + 1}`] : [])).join(' ') },
      }))));
  }
  if (presentation !== 'cards') ctx.warn(`the post list presentation ${presentation} is not one the design draws; drawn as cards`);
  return tag('div', { class: 'kn-post-list', 'data-kn-presentation': 'cards' }, tag('div', { class: 'kn-card-grid kn-cards' }, chosen.map((teaser) => teaserCard(teaser, ctx))));
}
