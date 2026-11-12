// The pages of a text post, laid out by its fields (directives.md, An article), for the article and for the site's own
// types made like it, the case study and the vacancy (src/lib/types.js):
//
// - opening(post, ctx, options): a Hero, its picture the main image, behind or beside the text as the design has it;
//   the trail, the headline in up to three parts (eyebrow, main headline, subheadline), the standfirst, then the meta
//   line and the topics, and after them whatever a type gives.
// - body(post, ctx, options): a band holding a Reading Area, the body in its flow; its Aside holds the following menu
//   "In this article", whose stops are the crossheads and the fact boxes with an anchor, or what a type gives instead.
// - readMore(post, ctx, options): a section of up to three related teasers, ranked as the core ranks them (ADR 0070),
//   under a heading, and a lone main action to the rest. It stands on a Surface of its own, so that it does not join
//   the body's band and stands apart from it.
import { heroAttributes } from '@kntnt/konzilo-design/components/hero-attributes.js';
import { heroProps } from '@kntnt/konzilo-design/design-props';
import { termName } from './content.js';
import { blocksOf, directiveOf, escapeText, isElement, tag, textOf, voidTag } from './html.js';
import { readMarkdown } from './markdown.js';
import { pictureSrc, WIDTHS } from './pictures.js';
import { isoDay, longDate, relatedPosts, teaserCard, teaserOf } from './posts.js';
import { actions, breadcrumbs, renderBlocks } from './render.js';

const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);
const link = (href, text) => tag('a', { href }, escapeText(text));

// The meta line (ADR 0062; directives.md, An article): the core's sentence, written by the format the article type has in
// the site's settings, each variable's value an element of its own, the authors and the category linked to their pages
// as the core's metaLine() links them where the taxonomy has an address (/insights/author/{slug}/,
// /insights/category/{slug}/); then the article's topics as pills, each a link to its topic's page, which the design
// parts from the sentence by a bullet of its own.
export const META_LINE_FORMAT = 'By {authors} • Published {date} in {category}';

export function metaLine(post, format = META_LINE_FORMAT) {
  const { data } = post;
  if (post.type !== 'article') return '';
  const category = [].concat(data.category ?? [])[0];
  const authors = [].concat(data.authors ?? []).map((slug) => link(`/insights/author/${slug}/`, termName('authors', slug)));
  const values = {
    authors: authors.length ? tag('span', { class: 'kn-article-byline' }, list(authors)) : '',
    date: data.date ? tag('time', { class: 'kn-article-date', datetime: isoDay(data.date) }, longDate(data.date)) : '',
    category: category ? tag('a', { class: 'kn-article-category', href: `/insights/category/${category}/` }, escapeText(termName('categories', category))) : '',
  };
  const topics = [].concat(data.topics ?? []);
  return tag('p', { class: 'kn-article-meta', 'data-kn-type': 'small' },
    tag('span', { class: 'kn-article-line' }, writeLine(format, values)),
    topics.length ? tag('span', { class: 'kn-article-topics' }, topics.map((slug) => tag('a', { class: 'kn-pill', href: `/insights/topic/${slug}/` }, escapeText(termName('topics', slug))))) : '');
}

// The format's words as text and each variable's value in its place; a variable without a value drops out with the
// words before it, back to the last punctuation mark, as the core's writeMetaLine() drops it.
function writeLine(format, values) {
  const parts = format.split(/\{(\w+)\}/);
  let out = '';
  for (let at = 0; at < parts.length; at += 2) {
    const words = parts[at];
    const name = parts[at + 1];
    if (name === undefined) { out += escapeText(words); break; }
    if (values[name]) out += escapeText(words) + values[name];
    else out += escapeText(words.replace(/[^\p{P}|]*$/u, ''));
  }
  return out.replace(/^[\s\p{P}]+/u, '').replace(/[\s•·,;:|-]+$/u, '').replace(/\s{2,}/g, ' ');
}

// `label` is the eyebrow where the post has none of its own (the category, for an article); `after` is HTML that follows
// the meta line in the hero's text, such as a type's facts or actions; `surface` is the hero's Surface where it has no
// picture.
export function opening(post, ctx, { label, after = '', surface } = {}) {
  const { data } = post;
  const settings = ctx.design.resolved.hero;
  const picture = data.image ? { src: data.image.src ?? data.image, alt: data.image.alt ?? '' } : null;
  const props = heroProps(settings, { behind: picture?.src, side: picture?.src, alt: picture?.alt });
  const behind = settings.picture === 'behind' && picture;
  const category = [].concat(data.category ?? [])[0];
  const eyebrow = data.eyebrow ?? label ?? (category ? termName('categories', category) : null);
  const ground = behind ? props.surface : surface;
  return tag('section', {
    class: 'kn-band kn-hero kn-article-opening', 'data-kn-surface': ground && ground !== 'page' ? ground : undefined,
    ...heroAttributes({ side: picture && !behind ? props.side ?? 'end' : undefined, height: settings.height, place: settings.place, align: settings.align }),
    style: behind ? `--kn-picture-image:url('${pictureSrc(picture.src, WIDTHS.behind)}')` : undefined,
  }, tag('div', { class: 'kn-band-content kn-hero-content' },
    tag('div', { class: 'kn-hero-text' },
      breadcrumbs(ctx),
      tag(settings.h1 === 'below' ? 'div' : 'hgroup', { class: 'kn-heading-group' },
        eyebrow ? tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, escapeText(eyebrow)) : '',
        tag(settings.h1 === 'below' ? 'p' : 'h1', { class: 'kn-heading-group-heading', 'data-kn-type': settings.type ?? 'heading-1' }, escapeText(data.headline ?? data.title)),
        data.subheadline ? tag('p', { class: 'kn-heading-group-subheadline' }, escapeText(data.subheadline)) : '',
        data.standfirst ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead' }, escapeText(data.standfirst)) : ''),
      metaLine(post),
      after),
    picture && !behind ? tag('div', { class: 'kn-hero-media' }, voidTag('img', { src: pictureSrc(picture.src, WIDTHS.hero), alt: picture.alt })) : ''));
}

// The following menu "In this article": its stops are every crosshead and every fact box with an anchor, in document
// order. Fewer than two stops make no menu.
function followingMenu(blocks, label = 'In this article') {
  const stops = blocks.flatMap((node) => {
    if (isElement(node, 'h2')) return [{ id: node.properties.id, label: textOf(node) }];
    if (directiveOf(node) === 'aside' && node.properties.dataAnchor) {
      const heading = blocksOf(node.children).find((child) => /^h[2-6]$/.test(child.tagName ?? ''));
      return [{ id: node.properties.dataAnchor, label: heading ? textOf(heading) : node.properties.dataAnchor }];
    }
    return [];
  });
  if (stops.length < 2) return '';
  return tag('aside', { class: 'kn-aside-block', 'data-kn-sticky': 'true' },
    tag('nav', { class: 'kn-toc', 'aria-labelledby': 'article-menu', 'data-kn-type': 'small', 'data-kn-follow': '' },
      tag('p', { class: 'kn-toc-label', id: 'article-menu', 'data-kn-type': 'heading-6' }, escapeText(label)),
      tag('ol', { role: 'list' }, stops.map((stop) => tag('li', {}, tag('a', { href: `#${stop.id}` }, escapeText(stop.label)))))));
}

// `aside` is the Aside's own HTML in place of the following menu; `menu` false leaves the menu out, and `label` is its
// label.
export function body(post, ctx, { aside, menu = true, label = 'In this article' } = {}) {
  const blocks = blocksOf(readMarkdown(post.body).children);
  // The interview's question: a paragraph of one <strong> alone.
  for (const node of blocks) {
    const parts = isElement(node, 'p') ? blocksOf(node.children) : [];
    if (parts.length === 1 && isElement(parts[0], 'strong')) node.properties.className = ['kn-question'];
  }
  const side = aside ?? (menu ? followingMenu(blocks, label) : '');
  // Crossheads take the article's steps from their place, so the body's headings carry no type.
  return tag('section', { class: 'kn-band kn-article-body' }, tag('div', { class: 'kn-band-content' },
    tag('div', { class: 'kn-reading-area', 'data-kn-side': 'start', 'data-kn-stack': 'before' },
      side ? tag('div', { class: 'kn-reading-area-aside' }, side) : '',
      tag('div', { class: 'kn-reading-area-flow kn-body-text' }, renderBlocks(blocks, ctx)))));
}

// Related posts of the same type, as the core ranks them.
export const related = (post, count = 3) => relatedPosts(post, count);

export function readMore(post, ctx, { heading = 'Read more', more = { label: 'More articles', href: '/insights/' }, surface = 'raised', chosen = related(post) } = {}) {
  if (!chosen.length) return '';
  const band = { ...ctx, ground: surface };
  const main = { type: 'element', tagName: 'ul', properties: {}, children: [{ type: 'element', tagName: 'li', properties: {}, children: [{ type: 'element', tagName: 'strong', properties: {}, children: [{ type: 'element', tagName: 'a', properties: { href: more.href }, children: [{ type: 'text', value: more.label }] }] }] }] };
  return tag('section', { class: 'kn-band kn-section', 'data-kn-surface': surface }, tag('div', { class: 'kn-band-content' },
    tag('header', { class: 'kn-section-head' }, tag('hgroup', { class: 'kn-heading-group' }, tag('h2', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-2' }, escapeText(heading)))),
    tag('div', { class: 'kn-section-body kn-body-text' },
      tag('div', { class: 'kn-card-grid kn-cards' }, chosen.map((other) => teaserCard(teaserOf(other), band))),
      more ? actions(main) : '')));
}

export const renderArticle = (post, ctx) => [opening(post, ctx), body(post, ctx), readMore(post, ctx)].join('\n');
