// The page's context that Konzilo Design's directive components and presentations read (its docs/spec/konzilo.md,
// The directives and the presentations), given once by every template that renders a body or a presentation, in its
// frontmatter, before <Body>: the design file, the post's title, which a hero shows as the page's H1, and the trail's
// levels as the core gives them. What a filtered list is of, its count, its terms and the search page it sends to, the
// core gives the presentation itself, as `list`.
import { breadcrumbs } from '@kntnt/konzilo/astro/breadcrumbs';
import { designPage } from '@kntnt/konzilo-design/design-props';
import design from '../../design/site.design.json';
import description from '../../site-description.json';

/**
 * The address of a term's page below the site's base, by its taxonomy's address in the site description, as Konzilo
 * Design's docs/spec/konzilo.md builds a topic's in its article template; null where the taxonomy has no pages. The core
 * gives no helper for it (its metaLine() makes the category's link itself).
 * @param {string} taxonomy The taxonomy's name in the site description: `topics`, `category` or `authors`.
 * @param {{ id: string }} term The term's entry, its id its slug.
 */
export function termUrl(taxonomy, term) {
  const address = description.taxonomies?.[taxonomy]?.address;
  return address ? `${import.meta.env.BASE_URL.replace(/\/$/, '')}${address.replace('{slug}', term.id).replace('{path}', term.id)}` : null;
}

// The word for each of the site's own taxonomies, its label in the site description, which a filtered list's row of
// its terms takes as its legend; the core's taxonomies keep Konzilo Design's words, "Category", "Topic" and "Author".
const words = {
  taxonomies: Object.fromEntries(Object.entries(description.taxonomies ?? {}).filter(([, taxonomy]) => typeof taxonomy.label === 'string').map(([name, taxonomy]) => [name, taxonomy.label])),
};

/**
 * Gives the page its context.
 * @param {object} Astro The template's Astro global.
 * @param {object} [options] `entry`, the post or term the page shows, whose trail the page takes; `title`, the H1 a
 *   hero shows, its title by default; `trail`, false for a page with no trail, such as the start page.
 */
export async function givePageContext(Astro, { entry, title = entry?.data?.title, trail = true } = {}) {
  return designPage(Astro, {
    design,
    title,
    breadcrumbs: trail && entry ? await breadcrumbs(entry, Astro.url) : [],
    words,
  });
}
