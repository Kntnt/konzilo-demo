// An article's page, laid out by its fields (directives.md, An article): the opening, a hero of its main image and
// headline; the body in a Reading Area with its following menu "In this article"; and "Read more", up to three related
// teasers, ranked as the core ranks them (Konzilo's ADR 0070, without the freshness, which a mockup has no use for).
import { heroAttributes } from '@kntnt/konzilo-design/components/hero-attributes.js';
import { heroProps } from '@kntnt/konzilo-design/design-props';
import { posts, termName } from './content.js';
import { blocksOf, directiveOf, escapeText, isElement, tag, textOf, voidTag } from './html.js';
import { readMarkdown } from './markdown.js';
import { pictureSrc, WIDTHS } from './pictures.js';
import { teaserCard, teaserOf } from './posts.js';
import { actions, breadcrumbs, renderBlocks } from './render.js';

const day = (value) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const list = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`);

export function opening(post, ctx) {
  const { data } = post;
  const settings = ctx.design.resolved.hero;
  const picture = data.image ? { src: data.image.src ?? data.image, alt: data.image.alt ?? '' } : null;
  const props = heroProps(settings, { behind: picture?.src, side: picture?.src, alt: picture?.alt });
  const behind = settings.picture === 'behind' && picture;
  const surface = behind ? props.surface : props.surface;
  const category = [].concat(data.category ?? [])[0];
  const categoryName = category ? termName('categories', category) : null;
  const authors = [].concat(data.authors ?? []).map((slug) => termName('authors', slug));
  const label = data.eyebrow ?? categoryName;
  return tag('section', {
    class: 'kn-band kn-hero kn-article-opening', 'data-kn-surface': surface,
    ...heroAttributes({ side: picture && !behind ? props.side ?? 'end' : undefined, height: settings.height, place: settings.place, align: settings.align }),
    style: behind ? `--kn-picture-image:url('${pictureSrc(picture.src, WIDTHS.behind)}')` : undefined,
  }, tag('div', { class: 'kn-band-content kn-hero-content' },
    tag('div', { class: 'kn-hero-text' },
      breadcrumbs(ctx),
      tag(settings.h1 === 'below' ? 'div' : 'hgroup', { class: 'kn-heading-group' },
        label ? tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, escapeText(label)) : '',
        tag(settings.h1 === 'below' ? 'p' : 'h1', { class: 'kn-heading-group-heading', 'data-kn-type': settings.type ?? 'heading-1' }, escapeText(data.headline ?? data.title)),
        data.subheadline ? tag('p', { class: 'kn-heading-group-subheadline' }, escapeText(data.subheadline)) : '',
        data.standfirst ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead' }, escapeText(data.standfirst)) : ''),
      tag('p', { class: 'kn-article-meta', 'data-kn-type': 'small' },
        data.date ? tag('span', { class: 'kn-article-date' }, 'Published ', tag('time', { datetime: new Date(data.date).toISOString().slice(0, 10) }, day(data.date))) : '',
        authors.length ? tag('span', { class: 'kn-article-byline' }, `By ${escapeText(list(authors))}`) : '',
        data.eyebrow && categoryName ? tag('span', { class: 'kn-article-category' }, escapeText(categoryName)) : '')),
    picture && !behind ? tag('div', { class: 'kn-hero-media' }, voidTag('img', { src: pictureSrc(picture.src, WIDTHS.hero), alt: picture.alt })) : ''));
}

export function body(post, ctx) {
  const blocks = blocksOf(readMarkdown(post.body).children);
  // The interview's question: a paragraph of one <strong> alone.
  for (const node of blocks) {
    const parts = isElement(node, 'p') ? blocksOf(node.children) : [];
    if (parts.length === 1 && isElement(parts[0], 'strong')) node.properties.className = ['kn-question'];
  }
  // The menu's stops: every crosshead, and every fact box with an anchor, in document order.
  const stops = blocks.flatMap((node) => {
    if (isElement(node, 'h2')) return [{ id: node.properties.id, label: textOf(node) }];
    if (directiveOf(node) === 'aside' && node.properties.dataAnchor) {
      const heading = blocksOf(node.children).find((child) => /^h[2-6]$/.test(child.tagName ?? ''));
      return [{ id: node.properties.dataAnchor, label: heading ? textOf(heading) : node.properties.dataAnchor }];
    }
    return [];
  });
  // Crossheads take the article's steps from their place, so the body's headings carry no type.
  return tag('section', { class: 'kn-band kn-article-body' }, tag('div', { class: 'kn-band-content' },
    tag('div', { class: 'kn-reading-area', 'data-kn-side': 'start', 'data-kn-stack': 'before' },
      stops.length ? tag('div', { class: 'kn-reading-area-aside' }, tag('aside', { class: 'kn-aside-block', 'data-kn-sticky': 'true' },
        tag('nav', { class: 'kn-toc', 'aria-labelledby': 'article-menu', 'data-kn-type': 'small', 'data-kn-follow': '' },
          tag('p', { class: 'kn-toc-label', id: 'article-menu', 'data-kn-type': 'heading-6' }, 'In this article'),
          tag('ol', { role: 'list' }, stops.map((stop) => tag('li', {}, tag('a', { href: `#${stop.id}` }, escapeText(stop.label)))))))) : '',
      tag('div', { class: 'kn-reading-area-flow kn-body-text' }, renderBlocks(blocks, ctx)))));
}

// Related posts of the same type: a point for each shared topic, half a point for the same category.
export function related(post, count = 3) {
  const topics = new Set([].concat(post.data.topics ?? []));
  const category = [].concat(post.data.category ?? [])[0];
  return posts().filter((other) => other.type === post.type && other.file !== post.file)
    .map((other) => ({ other, score: [].concat(other.data.topics ?? []).filter((topic) => topics.has(topic)).length + ([].concat(other.data.category ?? [])[0] === category && category ? 0.5 : 0) }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || new Date(b.other.data.date ?? 0) - new Date(a.other.data.date ?? 0))
    .slice(0, count).map(({ other }) => other);
}

export function readMore(post, ctx, { heading = 'Read more', more = { label: 'More articles', href: '/insights/' } } = {}) {
  const chosen = related(post);
  if (!chosen.length) return '';
  const list = { type: 'element', tagName: 'ul', properties: {}, children: [{ type: 'element', tagName: 'li', properties: {}, children: [{ type: 'element', tagName: 'strong', properties: {}, children: [{ type: 'element', tagName: 'a', properties: { href: more.href }, children: [{ type: 'text', value: more.label }] }] }] }] };
  return tag('section', { class: 'kn-band kn-section' }, tag('div', { class: 'kn-band-content' },
    tag('header', { class: 'kn-section-head' }, tag('hgroup', { class: 'kn-heading-group' }, tag('h2', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-2' }, escapeText(heading)))),
    tag('div', { class: 'kn-section-body kn-body-text' },
      tag('div', { class: 'kn-card-grid kn-cards' }, chosen.map((other) => teaserCard(teaserOf(other), ctx))),
      actions(list))));
}

export const renderArticle = (post, ctx) => [opening(post, ctx), body(post, ctx), readMore(post, ctx)].join('\n');
