// The templates of the site's own post types, made of the article's parts (src/lib/article.js) and the design's
// components, with each fact from a field of the type (design/content/editorial.md, The site's own types):
//
// - A case study, `case-study`: the opening, a Hero with the main image behind it, the customer as its eyebrow, the
//   headline and the standfirst; the body in a Reading Area whose Aside holds the project's facts, an Aside Block of a
//   Value List of the type's fields; other case studies; and a band that leads on to a site assessment.
// - A vacancy, `job`: the opening, a Hero without a picture, the title, the excerpt, a Value List of the type's fields
//   and the way to apply; the body in a Reading Area with its following menu; and the other vacancies as rows.
import { escapeText, tag } from './html.js';
import { body, opening, readMore } from './article.js';
import { chosenPosts, isoDay, longDate, presentation, relatedPosts, teaserOf } from './posts.js';
import { actions, renderMarkdown } from './render.js';

const md = String.raw;
const number = (value) => Number(value).toLocaleString('en-GB', { maximumFractionDigits: 1 });

// A Value List (directives.md, `list` with type="values"): each value under its small label, as HTML.
function valueList(items) {
  return tag('dl', { class: 'kn-value-list' }, items.filter((item) => item.value).map(({ label, value }) =>
    tag('div', { class: 'kn-value-list-item' }, tag('dt', { 'data-kn-type': 'small' }, escapeText(label)), tag('dd', { class: 'kn-value-list-value' }, value))));
}

// The Actions of directives.md from a list of links, the first the main action.
const actionList = (links) => actions({
  type: 'element', tagName: 'ul', properties: {},
  children: links.map(({ label, href }, index) => {
    const link = { type: 'element', tagName: 'a', properties: { href }, children: [{ type: 'text', value: label }] };
    return { type: 'element', tagName: 'li', properties: {}, children: [index === 0 ? { type: 'element', tagName: 'strong', properties: {}, children: [link] } : link] };
  }),
});

// ---------- case-study ----------

// The industry pages, by the values of the type's `industry` select.
const INDUSTRIES = { 'Logistics and warehousing': '/industries/logistics/', Manufacturing: '/industries/manufacturing/', 'Retail and commercial property': '/industries/retail/' };

// The project's facts, by the labels the type gives its fields.
export function projectFacts(post) {
  const { data } = post;
  const industry = data.industry && (INDUSTRIES[data.industry] ? tag('a', { href: INDUSTRIES[data.industry] }, escapeText(data.industry)) : escapeText(data.industry));
  return valueList([
    { label: 'Customer', value: data.customer && escapeText(data.customer) },
    { label: 'Industry', value: industry },
    { label: 'Location', value: data.location && escapeText(data.location) },
    { label: 'What we built', value: data.built && escapeText(data.built) },
    { label: 'Solar capacity', value: data.solarCapacity && `${number(data.solarCapacity)} MWp` },
    { label: 'Storage capacity', value: data.storageCapacity && `${number(data.storageCapacity)} MWh` },
    { label: 'Charge points', value: data.chargePoints && number(data.chargePoints) },
    { label: 'How it was paid for', value: data.contract && escapeText(data.contract) },
    { label: 'In service since', value: data.inService && tag('time', { datetime: isoDay(data.inService) }, longDate(data.inService)) },
  ]);
}

// The band that leads on from a case study: the template's own words, as a page's last section would hold them.
const assessment = md`::::section{surface="tint"}

## Find out what your site can do

An engineer visits, measures the roof, looks at the switch room and reads a year of your meter data. Within two weeks you have a report with the systems that fit, what they would give and what they cost.

:::list{type="actions"}

- **[Book a site assessment](/go/site-assessment/)**
- [Ask for a reference](/contact/)

:::

::::`;

export function renderCaseStudy(post, ctx) {
  const facts = tag('aside', { class: 'kn-aside-block', 'data-kn-surface': 'raised' },
    tag('h2', { 'data-kn-type': 'heading-6' }, 'The project'),
    projectFacts(post));
  // The other case studies: those that share most with this one, then the newest, filled up to three.
  const others = relatedPosts(post, 3);
  const more = others.length < 3 ? [...others, ...chosenPosts({ type: post.type, number: 3 }, post).filter((one) => !others.includes(one))].slice(0, 3) : others;
  return [
    opening(post, ctx, { label: post.data.customer }),
    body(post, ctx, { aside: facts }),
    readMore(post, ctx, { heading: 'More case studies', more: { label: 'All case studies', href: '/customers/' }, chosen: more }),
    renderMarkdown(assessment, { ...ctx, title: undefined }),
  ].join('\n');
}

// ---------- job ----------

export function jobFacts(post) {
  const { data } = post;
  return valueList([
    { label: 'Office', value: data.location && escapeText(data.location) },
    { label: 'Team', value: data.team && escapeText(data.team) },
    { label: 'Employment', value: data.employment && escapeText(data.employment) },
    { label: 'Last day to apply', value: data.closingDate && tag('time', { datetime: isoDay(data.closingDate) }, longDate(data.closingDate)) },
  ]);
}

export function renderJob(post, ctx) {
  const vacancy = { ...post, data: { ...post.data, standfirst: post.data.excerpt } };
  const apply = actionList([{ label: 'How to apply', href: '#how-to-apply' }]);
  const others = chosenPosts({ type: 'job', order: 'closingDate', direction: 'ascending', number: 10 }, post);
  const band = { ...ctx, ground: 'raised' };
  const all = actionList([{ label: 'All vacancies', href: '/about/careers/#open-positions' }]);
  return [
    opening(vacancy, ctx, { surface: 'tint', after: jobFacts(post) + apply }),
    body(post, ctx, { label: 'On this page' }),
    others.length ? tag('section', { class: 'kn-band kn-section', 'data-kn-surface': 'raised' }, tag('div', { class: 'kn-band-content' },
      tag('header', { class: 'kn-section-head' }, tag('hgroup', { class: 'kn-heading-group' }, tag('h2', { class: 'kn-heading-group-heading', 'data-kn-type': 'heading-2' }, 'Other vacancies'))),
      tag('div', { class: 'kn-section-body kn-body-text' }, presentation('rows', others.map(teaserOf), band, { type: 'job' }), all))) : '',
  ].join('\n');
}
