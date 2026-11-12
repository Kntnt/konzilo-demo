// Konzilo's Markdown read as the core reads it (Konzilo's src/astro/reader.js and directives.js): Sätteri with GFM,
// raw HTML and directives on and smart punctuation off; each directive as the core's plain rendering, a <div> with its
// name in data-directive and each attribute in data-<attribute>; a heading's anchor as its id; and a paragraph of an
// image alone as a figure, of several as a gallery. The result is the hast tree the core hands a component as its
// `content` (Konzilo's ADR 0068), which the renderers in render.js draw.
//
// Unlike the core it registers no list of directives: every name is read, so a misspelt one reaches render.js, which
// warns. A text directive (`:name`) reads as its text, as in the core, where none is registered.
import { htmlToHast, markdownToHtml } from 'satteri';

const FEATURES = Object.freeze({ gfm: true, rawHtml: true, smartPunctuation: false, directive: true });

const property = (name) => `data${name[0].toUpperCase()}${name.slice(1)}`;

const directives = {
  name: 'mockup-directives',
  options: { position: true },
  textDirective(node, ctx) {
    ctx.replaceNode(node, { type: 'text', value: ctx.source.slice(node.position.start.offset, node.position.end.offset) });
  },
  leafDirective: plain,
  containerDirective: plain,
};
function plain(node, ctx) {
  const properties = { dataDirective: node.name };
  for (const [name, value] of Object.entries(node.attributes ?? {})) properties[property(name)] = String(value);
  ctx.setProperty(node, 'data', { hName: 'div', hProperties: properties });
}

// The core's own: a heading's anchor, an empty raw <a> with its id before the text, becomes the heading's id.
const headingAnchors = {
  name: 'mockup-heading-anchors',
  element: {
    filter: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'],
    visit(node, ctx) {
      const [first] = node.children;
      const anchor = first?.type === 'element' && first.tagName === 'a' && first.children.length === 0
        && Object.keys(first.properties).join() === 'id' && typeof first.properties.id === 'string';
      if (!anchor || node.properties.id !== undefined) return;
      ctx.setProperty(node, 'id', first.properties.id);
      ctx.removeChildAt(node, 0);
    },
  },
};

// The core's figures (Konzilo's src/astro/figures.js), unchanged in what they make.
const element = (tagName, children, properties = {}) => ({ type: 'element', tagName, properties, children });
const isTag = (node, tagName) => node?.type === 'element' && node.tagName === tagName;
function linesOf(paragraph) {
  const lines = [{ after: null, nodes: [] }];
  let afterBreak = false;
  for (const node of paragraph.children) {
    if (isTag(node, 'br')) { lines.push({ after: 'hard', nodes: [] }); afterBreak = true; continue; }
    if (node.type === 'text') {
      const value = afterBreak ? node.value.replace(/^\n/, '') : node.value;
      value.split('\n').forEach((part, i) => {
        if (i > 0) lines.push({ after: 'soft', nodes: [] });
        if (part !== '') lines.at(-1).nodes.push({ ...node, value: part });
      });
    } else lines.at(-1).nodes.push(node);
    afterBreak = false;
  }
  return lines;
}
function figureOf(paragraph) {
  const items = [];
  let caption = null;
  for (const { after, nodes } of linesOf(paragraph)) {
    const [picture, ...rest] = nodes;
    const image = rest.length === 0 && isTag(picture, 'img') ? picture : null;
    if (nodes.length === 0 || caption !== null || (!image && nodes.some((node) => isTag(node, 'img')))) return null;
    if (after === 'hard') {
      const last = items.at(-1);
      if (!last || last.caption || image) return null;
      last.caption = nodes;
    } else if (image) items.push({ picture: image, caption: null });
    else if (items.length > 1) caption = nodes;
    else return null;
  }
  const figures = items.map((item) => element('figure', [item.picture, ...(item.caption ? [element('figcaption', item.caption)] : [])]));
  if (figures.length === 1) return figures[0];
  if (figures.length === 0) return null;
  return element('figure', [...figures, ...(caption ? [element('figcaption', caption)] : [])], { className: ['konzilo-gallery'] });
}
const figures = {
  name: 'mockup-figures',
  element: { filter: ['p'], visit(node, ctx) { const figure = figureOf(node); if (figure) ctx.replaceNode(node, figure); } },
};

const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));

// Astro gives a heading without an id one made from its text, as GitHub does.
function slugger() {
  const seen = new Map();
  return (text) => {
    const base = text.toLowerCase().trim().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count ? `${base}-${count}` : base;
  };
}
function headingIds(root) {
  const slug = slugger();
  const visit = (node) => {
    if (node.type === 'element' && /^h[1-6]$/.test(node.tagName)) {
      if (node.properties.id === undefined) node.properties.id = slug(textOf(node));
      else slug(String(node.properties.id));
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);
  return root;
}

// A body's Markdown as the core's hast tree: a root of its blocks, whitespace between them removed.
export function readMarkdown(markdown) {
  const { html } = markdownToHtml(String(markdown).trim(), { features: FEATURES, mdastPlugins: [directives], hastPlugins: [headingAnchors, figures] });
  return headingIds(htmlToHast(html, { fragment: true }));
}
