# The content

The text of every page of the demo site, in Konzilo's Markdown with Konzilo Design's directives, written so that the build phase can turn each file into a content file with little change. Everything here follows `../README.md`: its company, people, customers, pages, menu and footer.

## What is here

| Path | Holds | Written by |
|---|---|---|
| `site.json` | The site's title, slogan and description, the publisher, the header's call to action and search box, the menu with a line per second-level entry (Customers is not in it), the footer cell by cell, and the forms `contact`, `assessment` and `newsletter` with their confirmations; an acceptance field's label writes its link to the privacy policy as Markdown, `[privacy policy](/privacy-policy/)`, which the mockups draw as a link and the core cannot yet | the pages' agent |
| `pages/` | Every page but the term pages, at the path of its address: `pages/index.md` is `/`, `pages/solutions/index.md` is `/solutions/`, `pages/solutions/rooftop-solar.md` is `/solutions/rooftop-solar/` | the pages' agent |
| `canvases/site-assessment.md` | The landing page at `/go/site-assessment/`, with no header and footer | the pages' agent |
| `system/not-found.md` | The 404 page, as the post an Admin chooses for it | the pages' agent |
| `system/search.md` | The search page's words, by the core's keys, and an example query with what it should find | the pages' agent |
| `articles/`, `case-studies/`, `jobs/`, `authors/`, `categories/`, `topics/`, `editorial.md` | The articles, case studies, vacancies and their terms | the posts' agent |

## A file's form

Front matter, then the body.

- `type`: `page` or `canvas`.
- `address`: where the page answers. The build makes the slug and the parent from it.
- `title`: the post's title, which the hero shows as the page's H1. It is often a statement rather than the page's name.
- `breadcrumb`: the page's name in breadcrumbs, menus and the hero's eyebrow, where the title is a statement.
- `teaser`: `headline` and `text`, as a JSON object on one line, as the exact form writes it.
- `description`: the meta description, which the exact form writes as `seo.description`.

`date` and `modified` are left to the build. The 404 page has a title alone, as `not-found.md` does.

**Pictures** are `![alt text](image:<id>)`, an id from `../images/shot-list.md` or one proposed below; the build replaces the address with the master's. **Logos** are `![name](logo:<slug>)`, a file in `../logo/`: `ampfield`, `norrvik-logistics`, `brantevik-foods`, `lindhagen-furniture`, `westerport-retail-parks` and `kessel-packaging`. Alt texts of portraits and places are written to hold for any fitting photograph; refine them once the pictures are chosen.

**Pictures not in the shot list** that the pages use:

| Id | Shows | Used on |
|---|---|---|
| `pilot-controller` | An open electrical cabinet with energy meters, a small industrial computer and network cabling on DIN rails; no readable brand | Ampfield Pilot, the section beside "What you get" |
| `icon-solar`, `icon-battery`, `icon-charging`, `icon-pilot` | One-colour line symbols, SVG on a square `viewBox`: a solar panel, a battery, a charging plug, a line chart | Solutions, Logistics, Manufacturing and Retail, each as the cards' symbols, `symbol="item"` |
| `badge-iso-9001`, `badge-iso-14001`, `badge-iso-45001` | Plain round badges of Ampfield's own making that read "ISO 9001 certified" and so on; no certification body's mark | About us, the badges of "What we hold to" |

**Links** are the addresses in `../README.md`. Anchors are a section's `anchor` or a heading's `<a id>`. Links into the other agent's posts: the author pages `/insights/author/priya-raman/`, `/insights/author/elias-forsberg/`, `/insights/author/hannah-whitcombe/` and `/insights/author/lena-bergqvist/` (Team), the category pages `/insights/category/guides/`, `/insights/category/market-and-policy/` and `/insights/category/company-news/` (menu, Insights), the case studies `/customers/norrvik-logistics/`, `/customers/brantevik-foods/`, `/customers/lindhagen-furniture/` and `/customers/westerport-retail-parks/` (the Customers page, the list on the industry page it belongs to, and the solution it belongs to), and the feed `/insights/feed/` (footer).

**Writing:** British English. Percentages as `38%`, thousands with a comma, prices in euros, `MWp`, `kWh` and `m²` after a space.

## Directive syntax assumed

Neither Konzilo nor Konzilo Design records the Markdown attributes of the design system's directives; `docs/spec/directives.md` gives what each renders. These are the readings every file here keeps to, for the build phase to settle once against the package's `components.json` when it exists.

**Names and forms.** Containers `hero`, `section`, `aside`, `list`, `cards`, `accordion`, `tabs`, `toc` and `choice`; leaves `eyebrow` and `small`, each with its text as a label, `::eyebrow[…]`; the leaf `breadcrumbs` with no body. The five forms (cards, accordion, tabs, toc, choice) are directives of their own, as the gallery's comments name them (`:::cards`), not `:::list{form="…"}`, which ADR 0068's "the list … and its five forms" could also mean.

**Attributes**, each left out at its default:

| Directive | Attributes, as written here |
|---|---|
| `hero` | `surface`: `page`, `raised`, `inverse`, `tint`, `brand` or `accent`; left out, the design's default |
| `section` | `surface`, the same values, `page` the default; `anchor`, the section's `id` |
| `aside` | `anchor` |
| `list` | `type`: `description`, `values`, `logos` or `actions`; `markers`, as `markerAttributes` reads it (`v`, `x`, `1.`, `1./a)` and so on) |
| `cards` | `type="navigation"`; `markers`, `1` for steps and `v` for reasons or signed cards; `picture="behind"`; `symbol`: `item` or `heading` |
| `accordion` | `first`: `open` or `closed`; `expand`: `one` or `many` |
| `tabs`, `toc`, `choice` | none |

**What goes where.**

- **Hero:** `::breadcrumbs` first, a logo picture next where there is one, then `::eyebrow`, the deck as the first paragraph, the actions, `::small`, and the hero's picture last. The heading is the post's title; no `#` is written.
- **Section:** pictures first (the first is the section's picture, each further one a badge, every picture a paragraph of its own so that they do not read as a gallery), then eyebrows, the `##` heading, the deck and actions, then the body. A section with no heading has no head.
- **Items** of cards, accordion, tabs, toc and choice begin at their headings, `###` in a section with a heading and `##` in one without. What stands before the first heading is the intro: the label of navigation cards, tabs and toc, the question of a choice. Since an item begins at its heading, a card's picture and eyebrow are written **after** its heading, and the design places them first.
- **A card that is a link as a whole** has a link as its whole heading, `### [Rooftop solar](/solutions/rooftop-solar/)`, and no other link.
- **The main action** is the link in bold, `- **[Book a site assessment](/go/site-assessment/)**`: the strong around the link, not inside it.
- **A value list** item is the label, its one sub-item the value; a description list the same with the term and its descriptions.
- **Headings under a tab or an answer** are written one level below the item's, `####` under `###`, and the design raises them.
- **Fences** are in the exact form: a container's fence is one colon longer than the longest inside it, three where none is.
- **Rule 2 of `../README.md`** (tabs, accordions and cards hold only text, lists and pictures) is read with a `:::list` as a list, so actions in cards and choices, a value list in a tab, and a list in a card are allowed. A `toc` and a `choice` are not named by the rule; the FAQ's `toc` holds accordions and a description list, and a choice's answers hold text and actions.

## What the site description must declare

- **Elements.** `page`: paragraph, heading, list, quote, table, image, gallery, post-list, form and every directive above. `canvas`: paragraph, heading, list, image, form and the directives. The core's template leaves `quote` out of a page; the industry pages and Careers need it.
- **Addresses.** `page` at `/{path}/`, `canvas` at `/go/{slug}/`, `article` at `/insights/{slug}/`, `case-study` at `/customers/{slug}/`, `job` at `/about/careers/{slug}/`; categories at `/insights/category/{slug}/` and authors at `/insights/author/{slug}/`; the article feed at `/insights/feed/`; search at `/search/`.
- **Presentations** `cards`, `featured` and `filtered`; `filtered` with its rows, `filters="category topics search"` and the like, the attribute `directives.md` proposes and the core does not have yet.
- **Forms** as `site.json` declares them; the confirmations go to `settings.json` under `forms`.

**Assumed of the other agent's types,** for the post lists here to find anything:

- `case-study` takes the taxonomy `topics` (`solar`, `storage`, `charging`, `financing`, `grid`, `reporting`); a field `industry`, a select of the three industry pages' names, which each industry page lists by `where="industry=Logistics and warehousing"` and so on; and a boolean field `featured`, `true` for Norrvik Logistics alone, which Home shows.
- Brantevik Foods' case study carries `reporting`, so that the Ampfield Pilot page lists it; otherwise that list shows its `empty` text.
- `job` posts exist at `/about/careers/{slug}/`.

## What the legal pages assume

The privacy policy, the cookie policy and the forms' fine print state facts the build must make true:

- **No statistics:** no tag manager (`tagManager.manager` is `None`) and no departure in the site description's `consent.departures`. The site counts no visits, so the policies name no statistics service, no right to object to counting and nothing stored for measuring.
- **One embed:** the video in `articles/can-your-roof-carry-solar-panels.md`, on YouTube, the one embed service the posts use. The core puts YouTube under Marketing, since its provider advertises, so the registry holds two services, the consent's own storage and YouTube, and the categories Necessary and Marketing. `../mockups/pages/cookie-policy.astro` holds the declaration the core makes of it.
- **Forms:** a retention of 90 days for `contact` and `assessment`, and 30 days for `newsletter`.
- **Hosting:** a server in Sweden, backups in the EU. The web server keeps no log of visits, as the core's Caddyfile writes none; the log of addresses not found that Konzilo's ADR 0040 decides is not built, and the privacy policy says there is none.
- **No copy of a choice, and no reports kept:** the public site's pages send the record of each choice to `/_konzilo/consent` and each violation of the security policy to `/_konzilo/violations`, but the core's service takes neither yet (Konzilo's ADR 0044 keeps records for 13 months and reports for 30 days), so the privacy policy says Ampfield keeps no copy of a visitor's choice. When the core keeps them, the privacy policy must say so.
- **The consent texts** are the core's defaults.
- **The text after the cookie declaration**, which the template places below it: "Your browser may also keep things the site does not ask it to, such as its cache. You can remove what a site has stored in your browser's settings; that also removes your choice, and the site will ask again. Questions about this policy: privacy@ampfield.example."

## Telephone numbers and addresses

Swedish numbers are from the series reserved for fiction: Gothenburg's 031-390 06 00 to 99, written `+46 31 390 06 xx`, with the switchboard `00` and the operations centre `99`, and Malmö's 040-628 04 00 to 99, of which the Malmö office has `+46 40 628 04 00`. No series reserved for fiction was found for the Netherlands, so the Rotterdam office shows no number of its own and points to the switchboard. Leeds has `+44 113 496 0420`, from Ofcom's range for drama. The street addresses are invented, each a street name that its town does not have; the organisation number `559214-3871` and VAT number `SE559214387101` are placeholders. All e-mail is at `ampfield.example`.
