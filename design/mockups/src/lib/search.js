// The search page as the core writes it once its script has run (Konzilo's Search.astro and search-client.js), with
// the results the core's Typesense would give for a query over the published posts in design/content: a post's title
// (an article's headline), its type's label and its date, and a snippet of eight words on each side of the first match
// in its body, the matched word marked. konzilo.css draws it all.
//
// The ranking stands in for Typesense's: the order design/content/system/search.md gives for its example query first,
// then the title, the topics and the excerpt before the body, as the core weighs them (search.js, query_by_weights),
// then how often the body holds the word.
import { posts, termName } from './content.js';
import { escapeText, tag } from './html.js';
import { readMarkdown } from './markdown.js';
import { isPublished, longDate } from './posts.js';

const LABELS = { page: 'Page', article: 'Article', 'case-study': 'Case study', job: 'Vacancy' };
// The core's texts for the search page in Ampfield's words (design/content/system/search.md, The words).
export const TEXTS = {
  title: 'Search', label: 'Search the site', submit: 'Search',
  result: '1 result for “{query}”', results: '{count} results for “{query}”', page: ', page {page} of {pages}',
  pages: 'Pages of results', previous: 'Previous', next: 'Next',
  nothingFound: 'Nothing on the site matches your search. Try a shorter or more general word, such as “solar” or “battery”, or ask us.',
  needsJavaScript: 'Search needs JavaScript, which your browser does not run. Find your way from the menu, or write to hello@ampfield.example.',
};
const PAGE_SIZE = 10;

// A body as plain text, a block's words apart from the next block's, as the core's plainText() reads a body's HTML,
// which leaves out an embed's panel.
const BLOCKS = /^(p|li|ul|ol|dl|dt|dd|h\d|div|section|blockquote|figure|figcaption|table|tr|td|th|caption|hr|br)$/;
const plain = (markdown) => {
  const text = (node) => {
    if (node.type === 'text') return node.value;
    if (node.type === 'element' && (node.tagName === 'template' || [].concat(node.properties?.className ?? []).includes('konzilo-embed'))) return ' ';
    const inner = (node.children ?? []).map(text).join('');
    return node.type === 'element' && BLOCKS.test(node.tagName) ? ` ${inner} ` : inner;
  };
  return text(readMarkdown(markdown)).replace(/\s+/g, ' ').trim();
};

function documentOf(post) {
  const title = post.data.headline ?? post.data.title;
  return {
    post, title, address: post.address, label: LABELS[post.type] ?? 'Page', date: post.type === 'page' ? null : post.data.date,
    excerpt: post.data.excerpt ?? post.data.teaser?.text ?? post.data.standfirst ?? '',
    terms: [].concat(post.data.topics ?? []).map((slug) => termName('topics', slug)).join(' '),
    body: plain(post.body),
  };
}

// The snippet: eight words on each side of the first match in the body, the word itself in <mark>.
function snippet(body, word) {
  const words = body.split(' ');
  const at = words.findIndex((one) => one.toLowerCase().replace(/[^\p{L}\p{N}-]/gu, '').startsWith(word));
  if (at < 0) return null;
  const from = Math.max(0, at - 8);
  const to = Math.min(words.length, at + 9);
  return words.slice(from, to).map((one, index) => {
    if (from + index !== at) return escapeText(one);
    const [, lead, match, rest] = new RegExp(`^(\\W*)(${word}\\w*)(.*)$`, 'i').exec(one) ?? [null, '', one, ''];
    return `${escapeText(lead)}<mark>${escapeText(match)}</mark>${escapeText(rest)}`;
  }).join(' ');
}

export function search(query, { first = [], page = 1 } = {}) {
  const word = query.toLowerCase();
  const holds = (text) => new RegExp(`(^|[^\\p{L}])${word}`, 'iu').test(text);
  const found = posts()
    .filter((post) => post.address && isPublished(post) && ['page', 'article', 'case-study', 'job'].includes(post.type))
    .map(documentOf)
    .filter((one) => holds(one.title) || holds(one.terms) || holds(one.excerpt) || holds(one.body))
    .map((one) => {
      const count = (one.body.match(new RegExp(`(^|[^\\p{L}])${word}`, 'giu')) ?? []).length;
      const rank = first.indexOf(one.address);
      return { ...one, score: (rank >= 0 ? (first.length - rank) * 10000 : 0) + (holds(one.title) ? 400 : 0) + (holds(one.terms) ? 300 : 0) + (holds(one.excerpt) ? 200 : 0) + count };
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return { count: found.length, pages: Math.max(1, Math.ceil(found.length / PAGE_SIZE)), hits: found.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), word };
}

const fill = (text, values) => text.replace(/\{(\w+)\}/g, (whole, name) => (name in values ? String(values[name]) : whole));

// The core's search markup, after its script has filled it: the form with the query, the status, the results and the
// links to the other pages of them.
export function searchMarkup(query, options = {}) {
  const { count, pages, hits, word } = search(query, options);
  const page = options.page ?? 1;
  const status = count === 0 ? TEXTS.nothingFound : fill(count === 1 ? TEXTS.result : TEXTS.results, { count, query }) + (pages > 1 ? fill(TEXTS.page, { page, pages }) : '');
  const to = (n) => `?q=${encodeURIComponent(query)}&page=${n}`;
  return tag('div', { class: 'konzilo-search', 'data-konzilo-search': '/_konzilo/search', 'data-language-tag': 'en-GB' },
    tag('form', { role: 'search', method: 'get', action: '/search/' },
      tag('label', { for: 'konzilo-search-query' }, TEXTS.label),
      `<input id="konzilo-search-query" type="search" name="q" value="${escapeText(query)}">`,
      tag('button', { type: 'submit' }, TEXTS.submit)),
    tag('p', { class: 'konzilo-search-status', role: 'status' }, escapeText(status)),
    tag('ol', { class: 'konzilo-search-results' }, hits.map((hit) => {
      const text = snippet(hit.body, word) ?? escapeText(hit.excerpt);
      return tag('li', { class: 'konzilo-search-result' },
        tag('a', { href: hit.address }, escapeText(hit.title)),
        tag('p', { class: 'konzilo-search-about' }, tag('span', { class: 'konzilo-search-type' }, hit.label), hit.date ? ` ${tag('time', { datetime: new Date(hit.date).toISOString() }, longDate(hit.date))}` : ''),
        text ? tag('p', { class: 'konzilo-search-snippet' }, text) : '');
    })),
    tag('nav', { class: 'konzilo-search-pages', 'aria-label': TEXTS.pages, hidden: pages < 2 },
      page > 1 ? tag('a', { href: to(page - 1), rel: 'prev' }, TEXTS.previous) : '',
      page < pages ? tag('a', { href: to(page + 1), rel: 'next' }, TEXTS.next) : ''));
}

