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
| Case studies filtered by solution | Customers | The `filtered` presentation's rows of topics and search; the solutions are no taxonomy, and the topics Solar, Storage and Charging stand in for three of them |
| Related case studies on a page | The solutions, the industries | `include="topics:…"`; a page carries no terms, so `order="related"` has nothing to go by |
| A featured post on the first page of a paged list only | Insights | The featured list repeats on every page |
| A button text of the form's own | Book a site assessment | Every form gets the core's "Send" |
| A description under each entry of the menu | The header's menu | Nothing yet: the design system's menu draws one, the core's menu file has no field for it |
| The header's call to action in the design tool's preview | The design file | The preview and the presentation always say "Contact" |
| Key figures at the top of a case study | The case studies | Number fields of the type, and a fact box |
| A vacancy marked up as a job posting for search engines | The vacancies | Nothing: a site's own type may offer only the structured data types the core knows |
| An author's portrait | The author's page, an article's byline | Nothing from content: an author term holds a name and a biography |
| A source under a simple table | The articles | A footnote on the paragraph before the table, or a structured table with a caption |
| A list of vacancies | Careers, a vacancy | A presentation `rows` of the mockups' own, made from the Content Loop; `directives.md` has only `cards`, `featured` and `filtered` |
| A person's card with a portrait | Team | Ordinary cards with pictures cut to their wide format; the Card's `person` variant has no directive |
| Two options compared side by side under a head that is not centred | Home | A table |
| Words of a template that an editor can change | The case study's closing band, the term pages' newsletter band | Fixed words in the templates |
| A list of one teaser that fills its row, such as a wide card with its picture beside the text | Logistics and warehousing, Retail and commercial property: each lists the one case study of its industry | The ordinary card, a third of the row, since a series of one card stands in three columns |
| A customer's words beside the teasers of that customer's case study | The industry pages | The quotation in a band of its own on `raised` after the list, since in the list's section a head centred over two cards (rule 6) would stand over a quotation that keeps the start edge |
| A link in a form's label, "I have read the privacy policy (required)" with "privacy policy" a link | Contact, Book a site assessment, the newsletter | The mockups draw `[privacy policy](/privacy-policy/)` in a label as a link; the core writes a label as plain text |

## Faults and shortcomings in Konzilo Design

| What | How it shows |
|---|---|
| The components that render Konzilo's directives are not shipped | Konzilo 0.4.0 expects a package's component declarations (`componentsFrom`), its checks (`componentChecks`) and an Astro component per directive. Konzilo Design 0.6.1, like every release since 0.3.0, has the HTML contract, the CSS and helpers, and renderers in its gallery only. No file in either repository records the directives' attributes in Markdown |
| ADR 0068 of the core and `directives.md` disagree on what cards, accordion, tabs, toc and choice are | The ADR calls them the list's five forms; `directives.md` and the gallery treat them as directives of their own |
| `directives.md` does not say where an editor writes a card's picture and eyebrow, or that a section's badges must be paragraphs of their own | Items begin at their headings, yet the picture and the eyebrow are drawn before the heading; adjacent images become a gallery |
| `directives.md` writes a card's symbol with an empty alt text | The core's `content-format.md` says an image never goes without one |
| The menu's descriptions have no source | `Megamenu.astro` draws `child.description`; the core's menu holds `title`, `url` and `items`, and `menuProps` passes no description |
| `directives.md` does not say whether a fact box's own heading is a stop in the following table of contents | Both are written as `h2`, so the box could be listed |
| A hero's logo cannot follow the Surface it stands on | `.kn-hero-logo` is one picture that the editor chooses, while the header's logo changes with the mode; the light logo on a dark picture is hard to read |
| Neither `directives.md` nor `konzilo.md` says where a page without a hero puts its title and breadcrumbs | The mockups put them in a section's head before the body |
| `konzilo.css` does not style the core's button that opens the lightbox | `button.konzilo-lightbox-open` is styled only by the core's `modal.css` |
| Layout rule 6 centres a section's head for a reason no visitor can see | A head over two cards, two featured posts, cards without pictures or reasons is centred, on a page whose other heads start at the edge |
| A hero without a picture keeps its height | A title and one sentence stand at the bottom of an empty band two thirds of the window high; seen on term pages, the 404 page and the legal pages |
| A gallery's columns follow its width, not the number of its pictures | Four pictures stand three and one; `.konzilo-gallery` uses `auto-fill` |
| A choice's answers do not fill their rows | Four answers fall three and one |
| A table at phone width squeezes its columns word by word | It needs a least column width and a box that scrolls |
| A structured table narrower than its column does not stretch | Its rules end in the middle of the column |
| A fact box in a section's body spans the whole content width | The text beside it keeps the narrow measure |
| A long value in a value list breaks in the middle of a word | An e-mail address in a quarter column; `a[data-kn-contact]` in a half-width card too |
| A symbol cannot take the accent colour or follow the mode | Konzilo writes it as an `<img>` |
| The megamenu draws an entry without children as an empty column | Customers, before it was given the case studies; Customers has since left the menu |
| The design reads a table's column alignment from `data-kn-align`, which nothing writes | Konzilo writes `style="text-align: …"`, which its own policy on inline styles blocks (ADR 0051) |
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
| The client's own footer words cannot carry a link | `project.footer` holds words or lists of words, so the tool's preview and the presentation show "This site demonstrates Konzilo." without its link |
| The pager stands closer to the cards above it than the cards stand to each other | `.konzilo-pager` has the component gap above it, 18–20 px, under cards a column gap apart, 40–50 px; the lone action that shows more of a series has the column gap |
| A type role cannot set its line height | A light first heading over two lines keeps `heading-1`'s 1.3, set for a heavy heading, and looks loose; `display` has 1.1 |
| No output shows every component in the design's own colours and type | The presentation leaves out the directive components; the gallery shows them in the example design |
| Documents out of step with the code | `generator.md` and `konzilo.md` say a new design file is written at the first save, the tool writes it at launch; `generator.md` leaves out `project` keys; `names.md` leaves out `accent` for `hero.surface`; `konzilo.md` gives the package's size as 0.14 MB, it is 0.24 MB; `konzilo.md` and `directives.md` say the core refuses `data:` images, which it has allowed since ADR 0068 |

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
| A post list cannot choose the rows of a filtered list | `directives.md` proposes `filters="category topics search"`; `src/format/post-list.js` reads no such attribute, and the core writes no rows, hidden fields or search row |
| A term page does not tell its list what the page settles | A category's page must leave its Category row out and send `category=<slug>` with a search, a topic's page its topic, an author's page `author=<slug>`; `termPages()` passes nothing of it |
| The search page takes no taxonomy | `search-client.js` reads `q`, `page` and `type` only, and filters Typesense by type alone; a search from a filtered list sends `category`, `topic`, `author` and a site's own taxonomies, which the search page and the index must take, joined as the rows are, OR within a row and AND between rows, and show as chosen |
| A form field's label cannot hold a link | The site description's `label` is plain text; an acceptance field needs a link to the policy it accepts, as Markdown in the label or a field of its own |

## Pictures that are compromises

The picture agents' own judgement, from their reports on 2026-11-12, of the pictures that do not show what their page wanted. No free photograph that fits was found on Unsplash, Pexels, Pixabay or Wikimedia Commons, so a key to a service's interface does not by itself find a better one. Thomas settled the same day that each is searched for anew and, where no free photograph fits, generated (`docs/brief.md`). Check each against the picture as it is now before replacing it; `images/shot-list.md` says what each was meant to show, and `images/credits.json` what it shows.

| Picture | What is wrong with it |
|---|---|
| `article-fast-chargers` | A car park in the USA, and the chargers' shape is recognisably one maker's, though the name is blurred |
| `article-solar-costs` | Panels clamped to their rails on a gravel roof; the article wanted panels on pallets on a roof, waiting to be fitted |
| `article-depot-winter` | One charging post in deep snow by a stone wall, not a depot's yard |
| `article-grid-connection` | Two large transformers against an industrial building, where a small substation behind a fence was wanted; an organisation's account |
| `article-depot-lease` | One improvised socket box and one car, not a warehouse with a row of chargers |
| `article-battery-containers` | Battery containers in a Californian desert, with no fence and no concrete pad |
| `article-meters` | A bank of round meters as in the USA, not a European meter cabinet |
| `article-solar-noon`, `article-fleet-report` | Near what was wanted: no sun stands in the panels, and the vans are seen from the front |
| `battery-storage`, `article-battery-fire-safety` | Two frames of the same row of equipment cabinets in a solar field; nothing shows that they hold batteries, the place is no industrial yard, and the two look alike |
| `article-electric-truck` | The lorries are small in the frame and carry several blurred patches |
| `case-norrvik-charging` | One lorry at a fast charger, cut to a wide strip, where a depot of vans was wanted; taken by a company's own account, as `fleet-charging` is |
| `case-westerport` | Looks like a hotel's car park more than a retail park's, under a warm, grainy filter |
| `article-roof-ballast` | Not plainly an east–west array |
| `rooftop-install`, `article-roof-survey`, `case-norrvik-team` | The setting looks like Asia, eastern Europe or the tropics, not northern Europe; `case-norrvik-team` was since generated from such a photograph |
| `hero-home`, `industry-retail`, `industry-logistics-inside` | Small signs remain: on the warehouses, on the shops, and one in Chinese far down the aisle |
