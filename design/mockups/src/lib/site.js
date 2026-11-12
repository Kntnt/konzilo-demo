// The frame's content, from design/content/site.json, wired as Konzilo Design's docs/spec/konzilo.md shows a Konzilo site
// wiring it: the core's menu through menuProps, the brand through footerBrand, the footer through footerFromDesign,
// and the core's consent controls in the lower band's B2. Where site.json lacks a part, a provisional text stands in,
// marked PROVISIONAL here.
import { footerBrand, footerFromDesign, headerProps, logoAddresses, menuProps, pageProps } from '@kntnt/konzilo-design/design-props';
import { iconHtml, serviceOf } from '@kntnt/konzilo-design/directives';
import { design } from './design.js';
import { postByAddress, siteContent } from './content.js';
import { escapeAttribute, escapeText } from './html.js';

const site = siteContent();
export const SITE = site;
export const FORMS = site.forms ?? {};
export const EMAIL = site.publisher?.email ?? 'hello@ampfield.example';

// PROVISIONAL: used only where site.json has no menu.
const fallbackMenu = [
  { title: 'Solutions', url: '/solutions/' }, { title: 'Industries', url: '/industries/' },
  { title: 'Insights', url: '/insights/' }, { title: 'About', url: '/about/' },
];
const coreMenu = site.menu?.items ?? fallbackMenu;

// menuProps() turns the core's menu into Header's shape, but neither the core's menu nor menuProps carries a line of
// description, which the megamenu shows: site.json gives one, and it is put back here by address.
const descriptions = new Map();
(function collect(entries = []) { for (const entry of entries) { if (entry.url && entry.description) descriptions.set(entry.url, entry.description); collect(entry.items); } })(coreMenu);

export function menuFor(address) {
  return menuProps(coreMenu, { current: address, base: '/' }).map((entry) => ({
    ...entry,
    ...(entry.children ? { children: entry.children.map((child) => ({ ...child, ...(descriptions.has(child.href) ? { description: descriptions.get(child.href) } : {}) })) } : {}),
  }));
}

// The logos konzilo-design logos writes to public/logos, by addresses relative to a built page.
export const LOGOS = logoAddresses(design.project, { base: '.' });

const search = {
  action: '/search/', label: site.header?.search?.label ?? 'Search the site', word: site.header?.search?.word ?? 'Search',
  // The links under the search box, where the design shows them: the most asked-for pages. PROVISIONAL.
  links: [
    { label: 'Rooftop solar', href: '/solutions/rooftop-solar/' }, { label: 'Battery storage', href: '/solutions/battery-storage/' },
    { label: 'Case studies', href: '/customers/' }, { label: 'Contact', href: '/contact/' },
  ],
};
const cta = { label: site.header?.cta?.label ?? 'Book a site assessment', href: site.header?.cta?.url ?? '/go/site-assessment/' };

export function headerFor(address) {
  return headerProps(design.resolved.header, design.project, { menu: menuFor(address), logos: LOGOS, search, cta, home: '/', menuWord: site.header?.menuWord ?? 'Menu' });
}

export const PAGE_PROPS = pageProps(design.resolved.page);

// A cell's text, its lines kept.
const lines = (text) => `<p class="kn-footer-muted">${String(text).split('\n').map(escapeText).join('<br>')}</p>`;
const ICONS = { linkedin: 'linkedin', youtube: 'youtube', facebook: 'facebook', instagram: 'instagram', x: 'brand-x' };
// The social links as a row of icons, `.kn-footer-social`, as the design's own footer sample draws them.
function social(links) {
  const icon = (href) => (href.startsWith('mailto:') ? 'mail' : /feed|rss/.test(href) ? 'rss' : ICONS[serviceOf(href)?.service] ?? 'external-link');
  return `<ul class="kn-footer-social">${links.map(({ label, href }) => `<li><a href="${escapeAttribute(href)}" aria-label="${escapeAttribute(label)}">${iconHtml(icon(href))}</a></li>`).join('')}</ul>`;
}

// What the core's ConsentControls writes with links={false} (Konzilo's src/consent/markup.js): the two buttons, which
// the core shows once its script runs, so they show here.
export const CONSENT_BUTTONS = '<div class="konzilo-consent-controls"><div class="konzilo-consent-buttons"><button type="button" class="konzilo-consent-secondary" data-konzilo-consent-action="change">Change privacy settings</button><button type="button" class="konzilo-consent-secondary" data-konzilo-consent-action="withdraw">Withdraw consent</button></div></div>';

export function footerFor(address) {
  const { header, footer } = design.resolved;
  const given = site.footer ?? {};
  const topLevel = menuFor(address).map(({ label, href, current }) => ({ label, href, ...(current ? { current } : {}) }));
  const upperB1 = Array.isArray(given.upper?.b1?.links) ? given.upper.b1.links : [{ label: 'LinkedIn', href: 'https://www.linkedin.com/' }];
  const content = {
    upper: {
      a1: { content: footerBrand({ identity: header.identity, axis: header['brand-axis'], name: design.project.name, logo: LOGOS, surface: footer.upper.surface }) },
      b1: { content: social(upperB1) },
      a2: { content: lines(given.upper?.a2?.text ?? 'PROVISIONAL: one sentence about the company.') },
      b2: { links: topLevel },
    },
    lower: {
      a1: { content: lines(given.lower?.a1?.text ?? 'PROVISIONAL: the address.') },
      b1: { content: lines(given.lower?.b1?.text ?? 'PROVISIONAL: the registration line.') },
      a2: { links: Array.isArray(given.lower?.a2?.links) ? given.lower.a2.links : [{ label: 'Privacy policy', href: '/privacy-policy/' }] },
      // B2 is the core's consent controls, in the footer's slot lower-b2.
    },
  };
  return footerFromDesign(footer, content);
}

// The trail to a page, as the core derives it from the levels above its address (Konzilo's ADR 0037): each level's
// name in breadcrumbs, its `breadcrumb` or title, or the menu's word for it; a level with neither is left out.
export function trailFor(address, own) {
  if (!address || address === '/') return [];
  const parts = address.replace(/^\/|\/$/g, '').split('/');
  const menuWord = new Map();
  (function collect(entries = []) { for (const entry of entries) { if (entry.url) menuWord.set(entry.url, entry.title); collect(entry.items); } })(coreMenu);
  const trail = [];
  for (let depth = 1; depth < parts.length; depth++) {
    const href = `/${parts.slice(0, depth).join('/')}/`;
    const post = postByAddress(href);
    const label = post?.data.breadcrumb ?? post?.data.title ?? menuWord.get(href);
    if (label) trail.push({ label, href });
  }
  trail.push({ label: own });
  return trail;
}
