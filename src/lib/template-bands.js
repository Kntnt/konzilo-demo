// The bands a template adds that no post holds, such as the band that closes a case study, the other vacancies under a
// vacancy and the newsletter band of a term's page, written as the core writes a body's directives, each its plain
// rendering, <div data-directive="…"> with its attributes as data-<name>, so that the core's Body draws them with
// Konzilo Design's components exactly as it draws the same band in a page's body (the core's src/astro/directives.js,
// plainElement() and bodyParts()). Their words are the site's settings (site-description.json), and a link in a
// setting's text is written as Markdown.
//
//   <Body post={entry} html={section({ surface: 'tint', heading, text, blocks: [actions([...])] })} />

const escapeText = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttribute = (text) => escapeText(text).replace(/"/g, '&quot;');

/** A heading's id, as the core gives a body's crossheads theirs: its words in lower case, joined by hyphens. */
export const headingId = (text) => String(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s+/g, '-');

// A setting's text with each link written as Markdown, [words](address), as a link.
const withLinks = (text) => escapeText(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${escapeAttribute(href)}">${label}</a>`);

// A directive's plain rendering. An attribute's name in camel case is written with hyphens, maxCount as data-max-count.
function directive(name, attributes = {}, inner = '') {
  const data = Object.entries(attributes)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => ` data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}="${escapeAttribute(value)}"`)
    .join('');
  return `<div data-directive="${name}"${data}>${inner}</div>`;
}

/**
 * A section: its heading, its first paragraph, which the design draws as its deck, and its blocks.
 * @param {{ surface?: string, anchor?: string, heading?: string, text?: string, blocks?: string[] }} options
 */
export function section({ surface, anchor, heading, text, blocks = [] }) {
  const inner = [
    heading ? `<h2 id="${escapeAttribute(headingId(heading))}">${escapeText(heading)}</h2>` : '',
    text ? `<p>${withLinks(text)}</p>` : '',
    ...blocks,
  ].filter(Boolean).join('\n');
  return directive('section', { surface, anchor }, inner);
}

/**
 * A list of actions, the first the main action; one without its words or its address is left out.
 * @param {{ label?: string, href?: string }[]} links
 */
export function actions(links) {
  const items = links.filter(({ label, href }) => label && href).map(({ label, href }, at) => {
    const link = `<a href="${escapeAttribute(href)}">${escapeText(label)}</a>`;
    return `<li>${at === 0 ? `<strong>${link}</strong>` : link}</li>`;
  });
  return items.length ? directive('list', { type: 'actions' }, `<ul>${items.join('')}</ul>`) : '';
}

/**
 * A list of values, each value under its label: `value` is the value's HTML, as factsOf() (src/lib/facts.js) writes it.
 * @param {{ label: string, value: string }[]} items
 */
export function values(items) {
  return items.length ? directive('list', { type: 'values' }, `<ul>${items.map(({ label, value }) => `<li>${escapeText(label)}<ul><li>${value}</li></ul></li>`).join('')}</ul>`) : '';
}

/** A post list, by the attributes ::post-list takes. */
export const postList = (attributes) => directive('post-list', attributes);

/** A form of the site's, by its name. */
export const form = (name) => directive('form', { name });

/** Small print, a link in it written as Markdown. */
export const small = (text) => (text ? directive('small', {}, withLinks(text)) : '');
