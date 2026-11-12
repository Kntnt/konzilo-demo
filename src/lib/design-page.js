// The page's context that Konzilo Design's directive components and presentations read (its docs/spec/konzilo.md,
// The directives and the presentations), given once by every template that renders a body or a presentation, in its
// frontmatter, before <Body>: the design file, the post's title, which a hero shows as the page's H1, the trail's
// levels as the core gives them, and the search page and the types a filtered list sends and counts by.
import { breadcrumbs } from '@kntnt/konzilo/astro/breadcrumbs';
import { designPage } from '@kntnt/konzilo-design/design-props';
import design from '../../design/site.design.json';
import description from '../../site-description.json';

// The core's own names of its built-in types, which the site description does not repeat.
const BUILT_IN = { page: ['Page', 'Pages'], canvas: ['Canvas', 'Canvases'], article: ['Article', 'Articles'] };

// Each type by its collection: its name, which a search sends, and its label and plural, which a count takes.
const TYPES = Object.fromEntries(Object.entries(description.types).map(([name, type]) => [
  type.collection,
  { name, label: type.label ?? BUILT_IN[name]?.[0] ?? name, plural: type.plural ?? BUILT_IN[name]?.[1] ?? name },
]));

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
    search: `${import.meta.env.BASE_URL}${description.search.address.replace(/^\//, '')}`,
    types: TYPES,
  });
}
