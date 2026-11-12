// A term's page, as the site's term page (Konzilo's TermPage.astro, ADR 0039) would draw it with the design: an opening
// of the trail, the term's name as the page's H1 and its description as the deck, then the term's posts of every type that takes
// the taxonomy, newest first, ten a page, as teaser cards with the core's pager where they fill more than a page, then
// the newsletter band that Insights ends with. A term page has no picture: the term holds a name and a description.
//
//   termPage('categories', 'guides')   the page at /insights/category/guides/
//   termPage('authors', 'priya-raman', { page: 2 })
import { termsOf } from './content.js';
import { design } from './design.js';
import { escapeText, tag } from './html.js';
import { chosenPosts, pager, presentation, teaserOf } from './posts.js';
import { breadcrumbs, context, renderMarkdown } from './render.js';
import { EMAIL, FORMS, trailFor } from './site.js';

const md = String.raw;

// Each taxonomy with an address: its field on a post, the types that take it, its address and its eyebrow.
export const TAXONOMIES = {
  categories: { field: 'category', types: ['article'], address: '/insights/category/{slug}/', eyebrow: 'Category' },
  topics: { field: 'topics', types: ['article', 'case-study'], address: '/insights/topic/{slug}/', eyebrow: 'Topic' },
  authors: { field: 'authors', types: ['article'], address: '/insights/author/{slug}/', eyebrow: 'Author' },
};

// The band that ends a page of Insights: the newsletter, in the words the Insights page uses.
const newsletter = md`:::section{surface="tint" anchor="newsletter"}

## One e-mail a month

The month's articles, one chart from our analyst on prices and grid fees, and nothing else. Every issue has a link to unsubscribe.

::form{name="newsletter"}

::small[We keep your address only to send the newsletter. Read [how we handle personal data](/privacy-policy/).]

:::`;

export function termPage(collection, slug, { page = 1, number = 10 } = {}) {
  const taxonomy = TAXONOMIES[collection];
  const term = termsOf(collection)[slug];
  if (!taxonomy || !term) throw new Error(`No term ${collection}/${slug} in design/content.`);
  const address = taxonomy.address.replace('{slug}', slug);
  const ctx = context({ design, title: term.name, address, trail: trailFor(address, term.name), forms: FORMS, email: EMAIL });
  // The term's posts, of every type that takes the taxonomy, in one list, newest first.
  const lists = taxonomy.types.map((type) => chosenPosts({ type, include: `${taxonomy.field}:${slug}`, number: 100 }));
  const all = lists.flat().sort((a, b) => new Date(b.data.date ?? 0) - new Date(a.data.date ?? 0));
  const pages = Math.max(1, Math.ceil(all.length / number));
  const shown = all.slice((page - 1) * number, page * number);
  // The opening: the trail, the eyebrow, the name as the H1 and the description as its deck, in a section's head on
  // the Surface Insights opens on. Not a Hero: at the design's two-thirds of the window, a name and a sentence would
  // stand at the bottom of an empty band.
  const opening = tag('section', { class: 'kn-band kn-section', 'data-kn-surface': 'tint' }, tag('div', { class: 'kn-band-content' },
    tag('header', { class: 'kn-section-head' }, breadcrumbs(ctx),
      tag('hgroup', { class: 'kn-heading-group' },
        tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, escapeText(taxonomy.eyebrow)),
        tag('h1', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-1' }, escapeText(term.name)),
        term.description ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead', 'data-kn-deck': 'long' }, escapeText(term.description)) : ''))));
  const list = shown.length
    ? presentation('cards', shown.map(teaserOf), { ...ctx, ground: undefined }, { pagerHtml: pager(address, page, pages) })
    : tag('p', {}, 'Nothing to show yet.');
  const posts = tag('section', { class: 'kn-band kn-section' }, tag('div', { class: 'kn-band-content' }, tag('div', { class: 'kn-section-body kn-body-text' }, list)));
  return { title: term.name, address, html: [opening, posts, renderMarkdown(newsletter, { ...ctx, title: undefined })].join('\n') };
}
