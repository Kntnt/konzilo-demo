// The frame's props: Konzilo Design's Page, Header and Footer, wired as its docs/spec/konzilo.md shows a Konzilo site
// wiring them, as the approved design had them. Every word comes from where an Admin changes it:
// the menus (`main`, `social`, `search`), the site's settings, the core's search texts, or the design file.
import { footerBrand, footerFromDesign, headerProps, logoAddresses, menuProps, pageProps } from '@kntnt/konzilo-design/design-props';
import { iconHtml, serviceOf } from '@kntnt/konzilo-design/directives';

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A cell's text as the footer shows it: its lines kept, and a link written in it as Markdown, such as
// "[Konzilo](https://www.konzilo.com/)", drawn as a link. A cell's content is the site's own HTML (konzilo.md, The footer).
function lines(text) {
  const line = (words) => escape(words).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`);
  return `<p class="kn-footer-muted">${String(text).split('\n').map(line).join('<br>')}</p>`;
}

// The social links as a row of icons, as the design's own footer draws them: a service's icon by its address, an
// envelope for an e-mail address, the feed's icon for a feed, each named by the menu entry's title.
function socialRow(links) {
  const icon = (href) => (href.startsWith('mailto:') ? 'mail' : /\/feed\/?$|\.rss$/.test(href) ? 'rss' : serviceOf(href)?.icon ?? 'external-link');
  return `<ul class="kn-footer-social">${links.map(({ label, href }) => `<li><a href="${escape(href)}" aria-label="${escape(label)}">${iconHtml(icon(href))}</a></li>`).join('')}</ul>`;
}

// The props of the page, the header and the footer. `design`: the design file. `settings`: the site settings.
// `menus`: the entries of the menus `main`, `social` and `search`. `legal`: the legal pages, each { title, url }.
// `current`: the page's address, which marks the menu's current entry. `base`: the site's base. `home`: the start
// page's address. `search`: { address, label }, the search page's address and its field's label from the core's
// search texts.
export function frameProps({ design, settings, menus, legal, current, base, home, search }) {
  const { header, footer, page } = design.resolved;
  const based = (url) => (url.startsWith('/') && !url.startsWith('//') ? `${base.replace(/\/$/, '')}${url}` : url);
  const links = (entries = []) => entries.filter((entry) => entry.url).map(({ title, url }) => ({ label: title, href: based(url) }));
  const logos = logoAddresses(design.project, { base });
  // Each entry with the line of description an Admin writes under it, which the large menu shows.
  const menu = menuProps(menus.main ?? [], { current, base });
  const action = settings.headerActionPage && settings.headerActionLabel ? { label: settings.headerActionLabel, href: based(settings.headerActionPage.url) } : undefined;
  const headerFor = headerProps(header, design.project, {
    menu,
    logos,
    home,
    menuWord: settings.headerMenuWord,
    search: { action: based(search.address), label: search.label, word: settings.headerSearchWord, links: links(menus.search) },
    cta: action,
  });

  const content = {
    upper: {
      a1: { content: footerBrand({ identity: header.identity, axis: header['brand-axis'], name: design.project.name, logo: logos, surface: footer.upper.surface }) },
      b1: { content: socialRow(links(menus.social)) },
      a2: { content: lines(settings.footerAbout ?? '') },
      b2: { links: menu.filter((entry) => entry.href).map(({ label, href, current: here }) => ({ label, href, ...(here ? { current: true } : {}) })) },
    },
    lower: {
      a1: { content: lines(settings.footerAddress ?? '') },
      b1: { content: lines(settings.footerNote ?? '') },
      a2: { links: legal.map(({ title, url }) => ({ label: title, href: based(url) })) },
      // B2 is the core's consent controls, in the footer's slot lower-b2.
    },
  };

  return { page: pageProps(page), header: headerFor, footer: footerFromDesign(footer, content) };
}
