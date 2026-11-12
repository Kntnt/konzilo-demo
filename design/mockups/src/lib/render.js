// The design's renderers of Konzilo's directives: each takes a directive's attributes and its body as the core's hast
// tree (the `content` of Konzilo's ADR 0068) and writes the HTML Konzilo Design's docs/spec/directives.md specifies,
// with the package's own helpers for every fact and grouping (sectionParts, panelParts, markerAttributes, contactOf,
// serviceOf, allQuestions, surfaceOf, iconHtml, heroProps, heroAttributes, breadcrumbProps). The package's CSS draws it.
//
// The entry point is renderBody(root, ctx), for a whole body; renderBlocks() is for the blocks inside a part.
// `ctx` is made by context(): the design, the page's title, address and trail, the site's forms, the Surface of the band
// around a part (`ground`), and the page's ids. A component in the core's shape is a renderer with ctx bound:
// `RENDERERS.section(attributes, content.children, ctx)`.
import { allQuestions, contactOf, iconHtml, markerAttributes, panelParts, sectionParts, serviceOf, surfaceOf } from '@kntnt/konzilo-design/directives';
import { breadcrumbProps } from '@kntnt/konzilo-design/design-props';
import { heroAttributes } from '@kntnt/konzilo-design/components/hero-attributes.js';
import { attributesOf, blocksOf, directiveOf, escapeText, inner, isElement, isHeading, levelOf, outer, tag, textOf, voidTag, walk } from './html.js';
import { pictureSrc, WIDTHS } from './pictures.js';
import { coreForm } from './forms.js';
import { postList } from './posts.js';
import { readMarkdown } from './markdown.js';

// ---------- The context ----------

export function context({ design, title, address = '/', trail = [], forms = {}, email, post, home = '/', warn } = {}) {
  return {
    design, title, address, trail, forms, email, post, home, ground: undefined, ids: {}, promote: false,
    warn: warn ?? ((message) => console.warn(`mockups${address ? ` ${address}` : ''}: ${message}`)),
  };
}
const within = (ctx, ground) => ({ ...ctx, ground });
export function nextId(ctx, prefix) {
  ctx.ids[prefix] = (ctx.ids[prefix] ?? 0) + 1;
  return `${prefix}-${ctx.ids[prefix]}`;
}

// ---------- Reading blocks ----------

// The <img> a block shows alone: a figure of one image, with or without its caption, or a bare image.
export function pictureOf(node) {
  if (isElement(node, 'img')) return node;
  if (isElement(node, 'p')) {
    const parts = blocksOf(node.children);
    return parts.length === 1 && isElement(parts[0], 'img') ? parts[0] : null;
  }
  if (!isElement(node, 'figure') || [].concat(node.properties?.className ?? []).includes('konzilo-gallery')) return null;
  const parts = blocksOf(node.children);
  const image = parts.find((part) => isElement(part, 'img'));
  return image && parts.every((part) => isElement(part, 'img', 'figcaption')) ? image : null;
}
const image = (node, width, extra = {}) => voidTag('img', { ...extra, src: pictureSrc(node.properties.src, width), alt: node.properties.alt ?? '' });

const isActions = (node) => directiveOf(node) === 'list' && attributesOf(node).type === 'actions';

// What sectionParts() needs to know of a block.
function kindOf(node) {
  if (pictureOf(node)) return 'picture';
  const name = directiveOf(node);
  if (name === 'eyebrow') return 'eyebrow';
  if (isActions(node)) return 'actions';
  if (name === 'form') return 'form';
  if (name === 'choice') return 'choice';
  if (isElement(node, 'h2')) return 'heading';
  if (isElement(node, 'p')) return 'paragraph';
  return 'other';
}

// A form's items begin at its headings: every heading at the level of the first begins one, and what follows, up to
// the next, is its own; what stands before the first is the intro. Where `eyebrows` is set, eyebrows right before an
// item's heading are that item's, since an eyebrow is a label over a heading.
function itemsOf(blocks, { eyebrows = false } = {}) {
  const first = blocks.findIndex(isHeading);
  if (first < 0) return { intro: blocks, items: [] };
  const level = levelOf(blocks[first]);
  let start = first;
  if (eyebrows) while (start > 0 && directiveOf(blocks[start - 1]) === 'eyebrow') start--;
  const items = [];
  let pending = [];
  for (let at = start; at < blocks.length; at++) {
    const node = blocks[at];
    if (isHeading(node) && levelOf(node) === level) { items.push({ heading: node, before: pending, blocks: [] }); pending = []; continue; }
    if (eyebrows && directiveOf(node) === 'eyebrow') {
      let next = at;
      while (directiveOf(blocks[next]) === 'eyebrow') next++;
      if (isHeading(blocks[next]) && levelOf(blocks[next]) === level) { pending.push(node); continue; }
    }
    if (items.length) items.at(-1).blocks.push(node); else pending.push(node);
  }
  return { intro: blocks.slice(0, start), items };
}

// Under a tab or an answer, whose own heading is drawn as a button, the headings go up one level, never above h2.
function raise(blocks) {
  for (const block of blocks) for (const node of walk(block)) if (/^h[3-6]$/.test(node.tagName)) node.tagName = `h${levelOf(node) - 1}`;
}

// What a directive made, for panelParts(): anything but a text role.
const isComponent = (node) => { const name = directiveOf(node); return !!name && !['eyebrow', 'small', 'breadcrumbs'].includes(name); };

// An attribute of markerAttributes() as a hast property: data-kn-sign is dataKnSign.
const hastName = (name) => name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// A block the core writes, and the design styles as body text, written as it is, with its pictures made by id.
export function plain(node, ctx) {
  for (const element of walk(node)) {
    if (element.tagName === 'img' && typeof element.properties.src === 'string') element.properties.src = pictureSrc(element.properties.src, WIDTHS.figure);
  }
  // The core wraps a figure's picture in the button that opens its lightbox (Konzilo's Body.astro).
  if (isElement(node, 'figure')) {
    const figures = [].concat(node.properties?.className ?? []).includes('konzilo-gallery') ? blocksOf(node.children).filter((child) => isElement(child, 'figure')) : [node];
    for (const figure of figures) {
      figure.children = figure.children.map((child) => (isElement(child, 'img') ? {
        type: 'element', tagName: 'button',
        properties: { className: ['konzilo-lightbox-open'], type: 'button', ariaLabel: `Show larger: ${child.properties.alt ?? ''}` },
        children: [child],
      } : child));
    }
  }
  if (isElement(node) || node.type === 'text') return outer(node);
  return '';
}

// ---------- The body ----------

// A body's blocks as bands: each hero and section as itself, and every run of other blocks at the top level as a
// section without a Surface, as if the editor had put :::section around it (directives.md, The body of a page).
// A body without a hero has the page's title, and its trail, in a section of their own before it, as the site's
// page template writes them.
export function renderBody(root, ctx) {
  const blocks = blocksOf(root.children);
  const out = [];
  let run = [];
  const flush = () => { if (run.length) out.push(section({}, run, ctx)); run = []; };
  if (ctx.title && !blocks.some((node) => directiveOf(node) === 'hero')) out.push(titleBand(ctx));
  for (const node of blocks) {
    const name = directiveOf(node);
    if (name === 'hero') { flush(); out.push(hero(attributesOf(node), node.children, ctx)); }
    else if (name === 'section') { flush(); out.push(section(attributesOf(node), node.children, ctx)); }
    else run.push(node);
  }
  flush();
  return out.join('\n');
}

// Markdown, as a body.
export const renderMarkdown = (markdown, ctx) => renderBody(readMarkdown(markdown), ctx);

// The page's title where no hero holds it: its trail and its H1, as a section's head.
function titleBand(ctx) {
  return tag('section', { class: 'kn-band kn-section' }, tag('div', { class: 'kn-band-content' },
    tag('header', { class: 'kn-section-head' }, breadcrumbs(ctx),
      tag('hgroup', { class: 'kn-heading-group' }, tag('h1', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-1' }, escapeText(ctx.title))))));
}

// Blocks inside a part, in order: an eyebrow before a heading stands with it in a heading group, and one with no heading
// after it is a plain label (directives.md, ::eyebrow).
export function renderBlocks(blocks, ctx) {
  const out = [];
  for (let at = 0; at < blocks.length; at++) {
    const node = blocks[at];
    const name = directiveOf(node);
    if (name === 'eyebrow') {
      const run = [node];
      while (directiveOf(blocks[at + 1]) === 'eyebrow') run.push(blocks[++at]);
      const next = blocks[at + 1];
      if (isHeading(next)) {
        at++;
        out.push(tag('hgroup', { class: 'kn-heading-group' },
          run.map((eyebrow) => tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, inner(eyebrow))),
          tag(next.tagName, { class: 'kn-heading-group-heading', id: next.properties.id }, inner(next))));
      } else out.push(...run.map((eyebrow) => tag('p', { 'data-kn-type': 'label' }, inner(eyebrow))));
      continue;
    }
    out.push(name ? renderDirective(node, ctx) : plain(node, ctx));
  }
  return out.join('');
}

export function renderDirective(node, ctx) {
  const name = directiveOf(node);
  const renderer = RENDERERS[name];
  if (!renderer) {
    ctx.warn(`no renderer for the directive ${name}; it stands as the core's plain rendering`);
    return outer(node);
  }
  return renderer(attributesOf(node), node.children ?? [], ctx);
}

// ---------- hero ----------

export function hero(attrs, children, ctx) {
  const settings = ctx.design.resolved.hero;
  const blocks = blocksOf(children);
  const trail = blocks.filter((node) => directiveOf(node) === 'breadcrumbs');
  const firstText = blocks.findIndex((node) => !pictureOf(node) && directiveOf(node) !== 'breadcrumbs');
  const pictures = blocks.filter((node) => pictureOf(node));
  // A picture before the text is a logo; the last picture is the hero's.
  const logo = pictures.find((node) => firstText >= 0 && blocks.indexOf(node) < firstText) ?? null;
  const main = [...pictures].reverse().find((node) => node !== logo) ?? null;
  const eyebrows = blocks.filter((node) => directiveOf(node) === 'eyebrow');
  const deck = blocks.find((node) => isElement(node, 'p') && !pictureOf(node)) ?? null;
  const heading = blocks.find((node) => isElement(node, 'h1', 'h2'));
  const rest = blocks.filter((node) => !trail.includes(node) && node !== logo && node !== main && !eyebrows.includes(node) && node !== deck && node !== heading);
  const behind = settings.picture === 'behind' && main;
  const surface = behind ? `picture-${settings.overlay}` : attrs.surface ?? 'raised';
  const side = main && !behind ? (['start', 'end', 'start-bleed', 'end-bleed'].includes(settings.picture) ? settings.picture : 'end') : undefined;
  const below = settings.h1 === 'below';
  const title = ctx.title ? escapeText(ctx.title) : heading ? inner(heading) : '';
  const group = tag(below ? 'div' : 'hgroup', { class: 'kn-heading-group' },
    eyebrows.map((eyebrow) => tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, inner(eyebrow))),
    tag(below ? 'p' : 'h1', { class: 'kn-heading-group-heading', 'data-kn-type': settings.type ?? 'heading-1' }, title),
    deck ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead' }, inner(deck)) : '');
  const band = within(ctx, surface);
  ctx.promote = below;
  const mainPicture = main && pictureOf(main);
  return tag('section', {
    class: 'kn-band kn-hero', id: attrs.anchor,
    'data-kn-surface': surface === 'page' ? undefined : surface,
    ...heroAttributes({ side, height: settings.height, place: settings.place, align: settings.align }),
    style: behind ? `--kn-picture-image:url('${pictureSrc(mainPicture.properties.src, WIDTHS.behind)}')` : undefined,
  }, tag('div', { class: 'kn-band-content kn-hero-content' },
    tag('div', { class: 'kn-hero-text' },
      trail.length ? breadcrumbs(ctx) : '',
      logo ? image(pictureOf(logo), WIDTHS.logo || 800, { class: 'kn-hero-logo' }) : '',
      group,
      renderBlocks(rest, band)),
    main && !behind ? tag('div', { class: 'kn-hero-media' }, image(mainPicture, WIDTHS.hero)) : ''));
}

// ---------- section ----------

export function section(attrs, children, ctx) {
  const surface = attrs.surface && attrs.surface !== 'page' ? attrs.surface : undefined;
  const band = within(ctx, surface);
  const blocks = blocksOf(children);
  const parts = sectionParts(blocks.map((node) => ({ kind: kindOf(node), text: isElement(node, 'p') ? textOf(node) : undefined })));
  const out = [];
  if (parts.media.length) {
    const [first, ...badges] = parts.media.map((at) => pictureOf(blocks[at]));
    out.push(tag('div', { class: 'kn-section-media' },
      image(first, WIDTHS.section, { class: 'kn-section-picture' }),
      badges.length ? tag('ul', { class: 'kn-section-badges', role: 'list' }, badges.map((badge) => tag('li', {}, image(badge, 400)))) : ''));
  }
  if (parts.head.length) {
    const head = parts.head.map((at) => blocks[at]);
    const heading = head.find((node) => isElement(node, 'h2'));
    // Where the design puts the H1 under the hero, the next section's heading is the page's H1.
    const promoted = ctx.promote;
    ctx.promote = false;
    out.push(tag('header', { class: 'kn-section-head' },
      tag('hgroup', { class: 'kn-heading-group' },
        head.filter((node) => directiveOf(node) === 'eyebrow').map((eyebrow) => tag('p', { class: 'kn-heading-group-eyebrow', 'data-kn-type': 'label' }, inner(eyebrow))),
        tag(promoted ? 'h1' : 'h2', { class: 'kn-heading-group-heading', 'data-kn-type': promoted ? 'heading-1' : 'heading-2', id: heading.properties.id }, inner(heading)),
        parts.deck !== null ? tag('p', { class: 'kn-heading-group-deck', 'data-kn-type': 'lead', 'data-kn-deck': parts.deckLong ? 'long' : undefined }, inner(blocks[parts.deck])) : ''),
      head.filter(isActions).map((node) => renderDirective(node, band))));
  }
  if (parts.body.length) out.push(tag('div', { class: 'kn-section-body kn-body-text' }, renderBlocks(parts.body.map((at) => blocks[at]), band)));
  return tag('section', { class: 'kn-band kn-section', id: attrs.anchor, 'data-kn-surface': surface }, tag('div', { class: 'kn-band-content' }, out));
}

// ---------- aside ----------

function aside(attrs, children, ctx) {
  const blocks = blocksOf(children);
  const heading = blocks.find(isHeading);
  return tag('aside', { class: 'kn-fact-box', id: attrs.anchor, 'data-kn-surface': surfaceOf('fact-box', ctx.ground) },
    blocks.map((node) => {
      if (directiveOf(node) === 'eyebrow') return tag('p', { class: 'kn-fact-box-label', 'data-kn-type': 'label' }, inner(node));
      if (node === heading) return tag(node.tagName, { class: 'kn-fact-box-heading', 'data-kn-type': 'heading-5', id: node.properties.id }, inner(node));
      return renderBlocks([node], within(ctx, surfaceOf('fact-box', ctx.ground)));
    }));
}

// ---------- list ----------

// An item of a Markdown list: its own content, without a loose list's paragraph, and the items of the list it holds.
function itemParts(item) {
  const nested = item.children.filter((child) => isElement(child, 'ul', 'ol'));
  const own = item.children.filter((child) => !isElement(child, 'ul', 'ol')).flatMap((child) => (isElement(child, 'p') ? child.children : [child]));
  return { own: inner({ children: own }).trim(), subs: nested.flatMap((list) => list.children.filter((child) => isElement(child, 'li'))) };
}
const itemsOfList = (list) => list.children.filter((child) => isElement(child, 'li'));
const labels = (intro, ctx) => intro.map((node) => (isElement(node, 'p') ? tag('p', { 'data-kn-type': 'label' }, inner(node)) : renderBlocks([node], ctx))).join('');

function markList(list, markers, level = 1) {
  for (const [name, value] of Object.entries(markerAttributes(markers, level, list.tagName === 'ol'))) list.properties[hastName(name)] = value;
  for (const item of itemsOfList(list)) for (const child of item.children) if (isElement(child, 'ul', 'ol')) markList(child, markers, level + 1);
}

export function actions(list) {
  return tag('ul', { class: 'kn-actions', role: 'list' }, itemsOfList(list).map((item) => {
    const link = [...walk(item)].find((node) => node.tagName === 'a');
    if (!link) return tag('li', {}, inner(item));
    const main = [...walk(item)].some((node) => node.tagName === 'strong');
    const href = link.properties.href;
    const label = escapeText(textOf(link).trim());
    const known = serviceOf(href);
    return tag('li', {}, known
      ? tag('a', { class: 'kn-action', href, 'data-kn-main': main ? '' : undefined, 'data-kn-service': known.service }, iconHtml(known.icon), tag('span', { class: 'kn-action-label' }, label))
      : tag('a', { class: 'kn-action', href, 'data-kn-main': main ? '' : undefined }, label));
  }));
}

function list(attrs, children, ctx) {
  const blocks = blocksOf(children);
  const at = blocks.findIndex((node) => isElement(node, 'ul', 'ol'));
  if (at < 0) { ctx.warn('a :::list without a Markdown list'); return renderBlocks(blocks, ctx); }
  const [intro, body, outro] = [blocks.slice(0, at), blocks[at], blocks.slice(at + 1)];
  const after = renderBlocks(outro, ctx);
  switch (attrs.type) {
    case 'description':
      return labels(intro, ctx) + tag('dl', { class: 'kn-description-list' }, itemsOfList(body).map((item) => {
        const { own, subs } = itemParts(item);
        return tag('div', { class: 'kn-description-list-item' }, tag('dt', { 'data-kn-type': 'heading-6' }, own), subs.map((sub) => tag('dd', {}, itemParts(sub).own)));
      })) + after;
    case 'values':
      return labels(intro, ctx) + tag('dl', { class: 'kn-value-list' }, itemsOfList(body).map((item) => {
        const { own, subs } = itemParts(item);
        return tag('div', { class: 'kn-value-list-item' }, tag('dt', { 'data-kn-type': 'small' }, own), subs.map((sub) => tag('dd', { class: 'kn-value-list-value' }, itemParts(sub).own)));
      })) + after;
    case 'logos': {
      const id = intro.length ? nextId(ctx, 'logos') : undefined;
      return tag('div', { class: 'kn-logos' },
        intro.length ? tag('p', { class: 'kn-logos-label', id, 'data-kn-type': 'label' }, intro.map((node) => inner(node)).join(' ')) : '',
        tag('ul', { class: 'kn-logos-list', role: 'list', 'aria-labelledby': id }, itemsOfList(body).map((item) => {
          const link = [...walk(item)].find((node) => node.tagName === 'a');
          const picture = [...walk(item)].find((node) => node.tagName === 'img');
          if (!picture) return tag('li', {}, inner(item));
          const drawn = image(picture, WIDTHS.logo);
          return tag('li', {}, link ? tag('a', { href: link.properties.href }, drawn) : drawn);
        }))) + after;
    }
    case 'actions':
      return labels(intro, ctx) + actions(body) + after;
    default:
      if (attrs.type) ctx.warn(`a :::list of the unknown type ${attrs.type}, drawn as a plain list`);
      if (attrs.markers) markList(body, attrs.markers);
      return renderBlocks(intro, ctx) + plain(body, ctx) + after;
  }
}

// ---------- cards: series, steps, reasons ----------

function cards(attrs, children, ctx) {
  const blocks = blocksOf(children);
  const { intro, items } = itemsOf(blocks, { eyebrows: true });
  const numbering = markerAttributes(attrs.markers, 1, true);
  const sign = markerAttributes(attrs.markers, 1, false);
  const navigation = attrs.type === 'navigation';
  const pictured = items.some((item) => [...item.before, ...item.blocks].some((node) => pictureOf(node)));
  const rest = (item) => item.blocks;
  if (numbering['data-kn-numbering'] && !navigation) {
    return renderBlocks(intro, ctx) + tag('ol', { class: 'kn-timeline', ...numbering }, items.map((item) => tag('li', { class: 'kn-timeline-item' },
      tag(item.heading.tagName, { class: 'kn-timeline-heading', 'data-kn-type': 'heading-5', id: item.heading.properties.id }, inner(item.heading)),
      renderBlocks(rest(item), ctx))));
  }
  if (sign['data-kn-sign'] && !pictured && !attrs.picture && !attrs.symbol && !navigation) {
    return renderBlocks(intro, ctx) + tag('ul', { class: 'kn-reasons', role: 'list', ...sign }, items.map((item) => tag('li', { class: 'kn-reason' },
      tag(item.heading.tagName, { class: 'kn-reason-heading', 'data-kn-type': 'heading-5', id: item.heading.properties.id }, inner(item.heading)),
      renderBlocks(rest(item), ctx))));
  }
  const withActions = items.map((item) => item.blocks.some(isActions));
  const options = {
    behind: attrs.picture === 'behind',
    symbol: attrs.symbol === 'item' || attrs.symbol === 'heading' ? attrs.symbol : undefined,
    navigation,
    actionCards: withActions.includes(true) && withActions.includes(false),
  };
  if (navigation) {
    const id = intro.length ? nextId(ctx, 'navigation') : undefined;
    return tag('nav', { class: 'kn-cards-nav', 'aria-labelledby': id },
      intro.length ? tag('div', { class: 'kn-cards-label', id }, intro.map((node) => tag('p', { 'data-kn-type': 'label' }, inner(node)))) : '',
      // The series' own facts stand on the list, as on any series (directives.md, `cards`).
      tag('ul', {
        class: 'kn-card-grid kn-cards', role: 'list',
        'data-kn-picture': options.behind ? 'behind' : undefined,
        'data-kn-symbol': options.symbol,
      }, items.map((item) => tag('li', {}, card(item, options, ctx)))));
  }
  return renderBlocks(intro, ctx) + tag('div', {
    class: 'kn-card-grid kn-cards',
    ...(pictured ? sign : {}),
    'data-kn-picture': options.behind ? 'behind' : undefined,
    'data-kn-symbol': options.symbol,
  }, items.map((item) => card(item, options, ctx)));
}

// One item of a series, and a teaser of a post list (posts.js writes those with this markup too).
function card(item, { behind, symbol, navigation, actionCards }, ctx) {
  const blocks = [...item.before, ...item.blocks];
  const pictureBlock = blocks.find((node) => pictureOf(node));
  const picture = pictureBlock && pictureOf(pictureBlock);
  const eyebrows = blocks.filter((node) => directiveOf(node) === 'eyebrow');
  const rest = blocks.filter((node) => node !== pictureBlock && !eyebrows.includes(node));
  const link = [...walk(item.heading)].find((node) => node.tagName === 'a');
  const otherLink = rest.some((node) => [...walk(node)].some((element) => element.tagName === 'a'));
  const whole = !!link && !otherLink;
  const hasActions = rest.some(isActions);
  const surface = behind && picture ? surfaceOf('behind-card', ctx.ground)
    : whole ? surfaceOf('link-card', ctx.ground)
      : hasActions && actionCards ? surfaceOf('action-card', ctx.ground) : undefined;
  if (link && whole) link.properties.className = ['kn-card-link'];
  const mark = symbol && picture ? tag('span', { class: 'kn-card-symbol' }, voidTag('img', { src: pictureSrc(picture.properties.src, 400), alt: '' })) : '';
  const inside = within(ctx, surface ?? ctx.ground);
  return tag('article', { class: 'kn-card', 'data-kn-variant': navigation ? 'link' : undefined, 'data-kn-surface': surface ?? undefined },
    picture && !symbol ? image(picture, WIDTHS.card, { class: 'kn-card-picture' }) : '',
    symbol === 'item' ? mark : '',
    eyebrows.map((eyebrow) => tag('p', { class: 'kn-card-eyebrow', 'data-kn-type': 'label' }, inner(eyebrow))),
    tag(item.heading.tagName, { class: 'kn-card-heading', 'data-kn-type': 'heading-5', id: item.heading.properties.id }, symbol === 'heading' ? mark : '', inner(item.heading)),
    rest.map((node) => {
      if (isElement(node, 'p') && !pictureOf(node)) {
        const parts = blocksOf(node.children);
        if (parts.length === 1 && isElement(parts[0], 'a')) {
          const contact = contactOf(parts[0].properties.href, textOf(parts[0]));
          if (contact) parts[0].properties.dataKnContact = contact;
        }
        return tag('p', { class: 'kn-card-text', 'data-kn-type': 'small' }, inner(node));
      }
      return renderBlocks([node], inside);
    }),
    navigation ? iconHtml('arrow-right', 'kn-card-arrow') : '');
}

// ---------- accordion, tabs, toc, choice ----------

function accordion(attrs, children, ctx) {
  const { intro, items } = itemsOf(blocksOf(children));
  const single = attrs.expand === 'one';
  const name = single ? nextId(ctx, 'accordion') : undefined;
  return renderBlocks(intro, ctx) + tag('div', {
    class: 'kn-accordion', 'data-kn-accordion-mode': single ? 'single' : 'multiple',
    'data-kn-questions': allQuestions(items.map((item) => textOf(item.heading))) ? '' : undefined,
  }, items.map((item, index) => tag('details', { class: 'kn-accordion-item', name, open: attrs.first === 'open' && index === 0 },
    tag('summary', { class: 'kn-accordion-summary' },
      tag(item.heading.tagName, { class: 'kn-accordion-label', 'data-kn-type': 'heading-6', id: item.heading.properties.id }, inner(item.heading)),
      iconHtml('chevron-down', 'kn-accordion-chevron')),
    tag('div', { class: 'kn-body-text kn-accordion-content' }, renderBlocks([...item.before, ...item.blocks], ctx)))));
}

function tabs(attrs, children, ctx) {
  const { intro, items } = itemsOf(blocksOf(children));
  const name = nextId(ctx, 'tabs');
  const labelled = intro.length > 0;
  return tag('div', { class: 'kn-tabs', role: labelled ? 'group' : undefined, 'aria-labelledby': labelled ? name : undefined },
    labelled ? tag('div', { class: 'kn-tabs-label', id: name }, intro.map((node) => tag('p', { 'data-kn-type': 'label' }, inner(node)))) : '',
    items.map((item, index) => {
      raise(item.blocks);
      const parts = panelParts(item.blocks.map((node) => ({ component: isComponent(node) })));
      const panel = parts
        ? tag('div', { class: 'kn-tabs-text' }, renderBlocks(parts.text.map((at) => item.blocks[at]), ctx)) + tag('div', { class: 'kn-tabs-parts' }, renderBlocks(parts.parts.map((at) => item.blocks[at]), ctx))
        : renderBlocks(item.blocks, ctx);
      return tag('details', { class: 'kn-tabs-item', name, open: index === 0 }, tag('summary', { class: 'kn-tabs-tab' }, inner(item.heading)), tag('div', { class: 'kn-tabs-panel' }, panel));
    }));
}

function toc(attrs, children, ctx) {
  const { intro, items } = itemsOf(blocksOf(children));
  const id = nextId(ctx, 'toc');
  const label = intro.length ? inner(intro[0]) : null;
  if (intro.length > 1) ctx.warn('a :::toc whose intro is more than its label; the rest is left out');
  return tag('div', { class: 'kn-reading-area', 'data-kn-side': 'start', 'data-kn-stack': 'before' },
    tag('div', { class: 'kn-reading-area-aside' }, tag('aside', { class: 'kn-aside-block', 'data-kn-sticky': 'true' },
      tag('nav', { class: 'kn-toc', 'aria-labelledby': label ? id : undefined, 'aria-label': label ? undefined : 'Contents', 'data-kn-type': 'small', 'data-kn-follow': '' },
        label ? tag('p', { class: 'kn-toc-label', id, 'data-kn-type': 'heading-6' }, label) : '',
        tag('ol', { role: 'list' }, items.map((item) => tag('li', {}, tag('a', { href: `#${item.heading.properties.id}` }, escapeText(textOf(item.heading))))))))),
    tag('div', { class: 'kn-reading-area-flow' }, items.map((item) => outer(item.heading) + renderBlocks([...item.before, ...item.blocks], ctx))));
}

function choice(attrs, children, ctx) {
  const { intro, items } = itemsOf(blocksOf(children));
  const name = nextId(ctx, 'choice');
  const labelled = intro.length > 0;
  return tag('div', { class: 'kn-choice', role: labelled ? 'group' : undefined, 'aria-labelledby': labelled ? name : undefined },
    labelled ? tag('div', { class: 'kn-choice-label', id: name }, renderBlocks(intro, ctx)) : '',
    items.map((item) => {
      const blocks = [...item.before, ...item.blocks];
      raise(blocks);
      const onlyForm = blocks.length === 1 && directiveOf(blocks[0]) === 'form';
      const plate = onlyForm ? undefined : surfaceOf('choice-panel', ctx.ground);
      return tag('details', { class: 'kn-choice-item', name },
        tag('summary', { class: 'kn-choice-answer', 'data-kn-surface': surfaceOf('choice-answer', ctx.ground) }, inner(item.heading)),
        tag('div', { class: 'kn-choice-panel', 'data-kn-surface': plate }, renderBlocks(blocks, within(ctx, plate ?? ctx.ground))));
    }));
}

// ---------- text roles, the trail, forms and post lists ----------

export function breadcrumbs(ctx) {
  if (!ctx.trail?.length) return '';
  const props = breadcrumbProps(ctx.design.resolved.breadcrumbs, ctx.design.project, { trail: ctx.trail, home: ctx.home, homeWord: 'Home' });
  const shown = props.items.length - (props.current ? 0 : 1);
  if (shown < 2) return '';
  return tag('nav', { class: 'kn-breadcrumbs', 'aria-label': 'Breadcrumb', 'data-kn-type': 'small', 'data-kn-separator': props.separator, 'data-kn-home': props.home, 'data-kn-current': String(props.current), 'data-kn-narrow': props.narrow },
    tag('ol', { role: 'list' }, props.items.map((item, index) => tag('li', {},
      index > 0 ? '<span class="kn-breadcrumbs-separator" aria-hidden="true"></span>' : '',
      index === props.items.length - 1 ? tag('span', { 'aria-current': 'page' }, escapeText(item.label))
        : item.href ? tag('a', { href: item.href }, index === 0 ? iconHtml('house', 'kn-breadcrumbs-house') : '', tag('span', { class: 'kn-breadcrumbs-label' }, escapeText(item.label)))
          : tag('span', {}, escapeText(item.label))))));
}

function form(attrs, children, ctx) {
  const written = coreForm(attrs.name, ctx.forms, { page: ctx.address, email: ctx.email });
  if (written) return written;
  ctx.warn(`the form ${attrs.name} is not among the site's forms`);
  return tag('p', {}, `[The form ${escapeText(attrs.name)} is not declared in site.json]`);
}

export const RENDERERS = {
  hero, section, aside, list, cards, accordion, tabs, toc, choice, form,
  eyebrow: (attrs, children) => tag('p', { 'data-kn-type': 'label' }, inner({ children })),
  small: (attrs, children) => tag('p', { class: 'kn-fine-print', 'data-kn-type': 'small' }, inner({ children })),
  breadcrumbs: (attrs, children, ctx) => breadcrumbs(ctx),
  'post-list': (attrs, children, ctx) => postList(attrs, ctx),
};

