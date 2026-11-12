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
| Key figures at the top of a case study | The case studies | Number fields of the type, and a fact box |
| A vacancy marked up as a job posting for search engines | The vacancies | Nothing: a site's own type may offer only the structured data types the core knows |
| An author's portrait | The author's page, an article's byline | Nothing from content: an author term holds a name and a biography |
| A source under a simple table | The articles | A footnote on the paragraph before the table, or a structured table with a caption |
| Topics in an article's opening | The articles | Pills at the end of the meta line; `directives.md` has no part for them |
| A list of vacancies | Careers, a vacancy | A presentation `rows` of the mockups' own, made from the Content Loop; `directives.md` has only `cards`, `featured` and `filtered` |
| A person's card with a portrait | Team | Ordinary cards with pictures cut to their wide format; the Card's `person` variant has no directive |
| Two options compared side by side under a head that is not centred | Home | A table |
| Words of a template that an editor can change | The case study's closing band, the term pages' newsletter band | Fixed words in the templates |

## Faults and shortcomings in Konzilo Design

| What | How it shows |
|---|---|
| The components that render Konzilo's directives are not shipped | Konzilo 0.4.0 expects a package's component declarations (`componentsFrom`), its checks (`componentChecks`) and an Astro component per directive. Konzilo Design 0.3.0 has the HTML contract, the CSS and helpers, and renderers in its gallery only. No file in either repository records the directives' attributes in Markdown |
| ADR 0068 of the core and `directives.md` disagree on what cards, accordion, tabs, toc and choice are | The ADR calls them the list's five forms; `directives.md` and the gallery treat them as directives of their own |
| `directives.md` does not say where an editor writes a card's picture and eyebrow, or that a section's badges must be paragraphs of their own | Items begin at their headings, yet the picture and the eyebrow are drawn before the heading; adjacent images become a gallery |
| `directives.md` writes a card's symbol with an empty alt text | The core's `content-format.md` says an image never goes without one |
| The menu's descriptions have no source | `Megamenu.astro` draws `child.description`; the core's menu holds `title`, `url` and `items`, and `menuProps` passes no description |
| `directives.md` does not say whether a fact box's own heading is a stop in the following table of contents | Both are written as `h2`, so the box could be listed |
| `directives.md` says the meta line is the date and the byline | Its markup and the next rule put the category there too |
| A hero's logo cannot follow the Surface it stands on | `.kn-hero-logo` is one picture that the editor chooses, while the header's logo changes with the mode; the light logo on a dark picture is hard to read |
| Neither `directives.md` nor `konzilo.md` says where a page without a hero puts its title and breadcrumbs | The mockups put them in a section's head before the body |
| `konzilo.css` does not style the core's button that opens the lightbox | `button.konzilo-lightbox-open` is styled only by the core's `modal.css` |
| Layout rule 6 centres a section's head for a reason no visitor can see | A head over two cards, two featured posts, cards without pictures or reasons is centred, on a page whose other heads start at the edge |
| A hero without a picture keeps its height | A title and one sentence stand at the bottom of an empty band two thirds of the window high; seen on term pages, the 404 page and the legal pages |
| A link in a Content Loop inside body text looks like a body link | `.kn-body-text a` outweighs `.kn-content-link`; the Card avoids it with `.kn-card .kn-card-link` |
| A gallery's columns follow its width, not the number of its pictures | Four pictures stand three and one; `.konzilo-gallery` uses `auto-fill` |
| A choice's answers do not fill their rows | Four answers fall three and one |
| A table at phone width squeezes its columns word by word | It needs a least column width and a box that scrolls |
| A structured table narrower than its column does not stretch | Its rules end in the middle of the column |
| A fact box in a section's body spans the whole content width | The text beside it keeps the narrow measure |
| A long value in a value list breaks in the middle of a word | An e-mail address in a quarter column; `a[data-kn-contact]` in a half-width card too |
| A symbol cannot take the accent colour or follow the mode | Konzilo writes it as an `<img>` |
| The megamenu draws an entry without children as an empty column | Customers, before it was given the case studies |
| The design reads a table's column alignment from `data-kn-align`, which nothing writes | Konzilo writes `style="text-align: …"`, which its own policy on inline styles blocks (ADR 0051) |
| The core's default meta line and the design's do not match | The core writes one sentence, "Published on {date} in {category} by {authors}"; the design draws three spans with dots between |
| A test fixture writes the embed placeholder's policy link without the attribute the core adds | `test/fixtures/konzilo-page.html` lacks `data-konzilo-consent-policy` |
| The export for agents carries no stylesheet | `DESIGN.md` describes the look; no export bundles the real CSS of a site (the design's core, `konzilo.css`, the components, the font faces) as one file, so an agent can only rebuild it by hand |
| `directives.md` says "No inline style", and the components write one | `Band.astro` writes the hero's picture as `style="--kn-picture-image:url(…)"`, and a relative address there resolves against the stylesheet's folder; `--kn-hero-screen` is not in `DESIGN.md` |
| The icon files of the export and the components' icon set use different names | `brand-linkedin` and `triangle-exclamation-point` in the export; `linkedin` and `triangle-alert` in the set |
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
| A component that splits its body cannot place what the core rendered | A section, tabs and cards get nested components in their `content` tree only as the core's plain rendering, so each must draw every other directive from the tree itself. ADR 0068 leaves a way for the core to render part of a tree until a design asks for it; this design does |
| A form's button text cannot be set | ADR 0045 says an editor may; the site description and `::form` have no field for it |
| An acceptance test nests fences the wrong way round | `acceptance/preview-components.test.js` puts the longer fence inside the shorter |
| `content-format.md` does not say whether a site's own type may use the built-in `topics` taxonomy | The case studies and the pages that list them assume it may |
| A visitor's choice about consent is not kept on the server | The public pages send a record of each choice to `/_konzilo/consent`; the service handles only forms and answers 404. ADR 0044 says such records are kept for 13 months, and the cookie declaration shows a consent ID that nobody can look up |
| Reports of breaches of the security policy are not kept | Pages report to `/_konzilo/violations`; no handler exists. ADR 0044 says 30 days |
| The log of addresses that were not found is not built | ADR 0040; the web server writes no log at all |
| The core's two texts on YouTube disagree | Its facts say the provider lists nothing that it stores; the placeholder says it "may store data in your browser" |
| Pinning the core by a token is not built | ADR 0011; `new-site` pins by a path on the machine |
