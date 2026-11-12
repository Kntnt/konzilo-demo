# Gaps

What the design phase wanted and could not have, and the faults it found on the way. Each entry ends as a fix or a feature request in the repository it belongs to; until then it is recorded here.

## What a page wanted and the directives could not render

| Wish | Where | Used instead |
|---|---|---|
| Key figures as large numbers | Home, About us, the industries | The value list, `:::list{type="values"}` |
| A history marked by years | About us | A description list with the years as terms; the timeline only numbers its steps |
| A customer's words set large, with name and role | The industries, Careers | A quotation with `<cite>`; the Quotation component has no directive |
| A call-to-action band | Every marketing page | A section on the brand Surface with a heading and actions; the CTA Band component has no directive |
| The control for objecting to the counting of visits, placed in a page | Privacy policy | A pointer to the privacy settings |
| Case studies filtered by solution | Customers | The `filtered` presentation, which filters by topics only |
| Related case studies on a page | The solutions, the industries | `include="topics:…"`; a page carries no terms, so `order="related"` has nothing to go by |
| A featured post on the first page of a paged list only | Insights | The featured list repeats on every page |
| A button text of the form's own | Book a site assessment | Every form gets the core's "Send" |
| A description under each entry of the menu | The header's menu | Nothing yet: the design system's menu draws one, the core's menu file has no field for it |
| The header's call to action in the design tool's preview | The design file | The preview and the presentation always say "Contact" |

## Faults and shortcomings in Konzilo Design

| What | How it shows |
|---|---|
| The components that render Konzilo's directives are not shipped | Konzilo 0.4.0 expects a package's component declarations (`componentsFrom`), its checks (`componentChecks`) and an Astro component per directive. Konzilo Design 0.3.0 has the HTML contract, the CSS and helpers, and renderers in its gallery only. No file in either repository records the directives' attributes in Markdown |
| ADR 0068 of the core and `directives.md` disagree on what cards, accordion, tabs, toc and choice are | The ADR calls them the list's five forms; `directives.md` and the gallery treat them as directives of their own |
| `directives.md` does not say where an editor writes a card's picture and eyebrow, or that a section's badges must be paragraphs of their own | Items begin at their headings, yet the picture and the eyebrow are drawn before the heading; adjacent images become a gallery |
| `directives.md` writes a card's symbol with an empty alt text | The core's `content-format.md` says an image never goes without one |
| The menu's descriptions have no source | `Megamenu.astro` draws `child.description`; the core's menu holds `title`, `url` and `items`, and `menuProps` passes no description |
| The hero directive's default Surface is `raised` | The design's own default for a hero without a picture is `none` |
| A design resolved by an older generator passes `design-check` and `fromDesign` | A file resolved by 0.2.0 passes under 0.3.0, though 0.3.0 changed the dark-mode values |
| `resolve` keeps role settings that the chosen typeface lacks | The new design's Mona Sans axes stay after a change of typeface; only the tool prunes them |
| `fonts` copies nothing, silently, for a typeface name that differs in case or spelling | `faceOf` matches the first family name exactly |
| DESIGN.md says "Brand: the logo" for a design with no logo | "This design's frame" ignores what "Name, slogan and logo" correctly says |
| The header's call-to-action label cannot be set in a design | `project` has `menu` and `footer` but no field for it |
| The Logos list shows each logo as it is, in both modes | A one-colour logo must be a grey that holds on every ground, and is weak on `brand`, `accent` and `inverse` |
| The warning status looks like the secondary tint when the secondary colour is amber | `status-warning` and `tint-secondary` resolve to almost the same values in both modes |
| `design-presentation` writes inside Konzilo Design's own folder | It rewrites ignored files under `presentation/.astro/` and uses `node_modules/.cache/` |
| No output shows every component in the design's own colours and type | The presentation leaves out the directive components; the gallery shows them in the example design |
| Documents out of step with the code | `generator.md` and `konzilo.md` say a new design file is written at the first save, the tool writes it at launch; `generator.md` leaves out `project` keys; `names.md` leaves out `accent` for `hero.surface`; `konzilo.md` gives the package's size as 0.14 MB, it is 0.23 MB; `konzilo.md` and `directives.md` say the core refuses `data:` images, which it has allowed since ADR 0068 |

## Faults and shortcomings in Konzilo

| What | How it shows |
|---|---|
| The site template does not use the design system | `site-template/files/` has its own simple styles and no `fromDesign`; wiring the design in is manual work after `konzilo.md` |
| Everything cannot run in one container | The programs name their peers by fixed hostnames (`forgejo`, `typesense`, `editors`, `visitors`) and share fixed folders (`/secret`, `/work`) that hold different things for different services |
| A start installs packages from the network | `compose/builder/prepare-site.sh` runs `npm install` at every start of the builder and the preview |
| The editor's sign-in breaks when the ports change after the first start | `compose/seed/seed.js` sets the editor's OAuth redirect once and never updates it, unlike the preview's |
| Only one person is seeded | `anna`, an Admin; the Editor and Reviewer roles cannot be shown without more accounts |
| Only the hostname `localhost` is accepted | `origin()` in `src/astro/public-site.js` refuses `127.0.0.1` and `*.localhost` |
| A component that draws its items from its tree loses nested components and the lightbox | Issue #55; tabs, accordions and cards can hold only text, lists and pictures |
| A form's button text cannot be set | ADR 0045 says an editor may; the site description and `::form` have no field for it |
| An acceptance test nests fences the wrong way round | `acceptance/preview-components.test.js` puts the longer fence inside the shorter |
| Pinning the core by a token is not built | ADR 0011; `new-site` pins by a path on the machine |
