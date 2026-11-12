# Editorial content

The site's articles, case studies and vacancies, and the terms that sort them: what each file holds, the two post types of the site's own that they need, and the assumptions made where neither Konzilo nor Konzilo Design records the exact Markdown.

| Folder | Holds |
|---|---|
| `articles/` | Nine articles, the core's type `article` |
| `case-studies/` | Four case studies, the site's own type `case-study` |
| `jobs/` | Three vacancies, the site's own type `job` |
| `authors/`, `categories/`, `topics/` | The terms of the article's three built-in taxonomies |

## The form of the files

- **Content-file form.** Each post is front matter and a body as `content-format.md` gives a content file: the keys in the order the type declares them, every value on one line, a text, list or object as JSON, a moment and a day unquoted. The terms are JSON as `JSON.stringify(value, null, 2)` writes them.
- **Pictures by id.** A picture in a body is `![alt](image:<id>)`, and a post's main image is `image: {"src":"image:<id>","alt":"…"}`, each id from `design/images/shot-list.md`. The build replaces `image:<id>` with the master's path, `../media/<slug>-<hash>.webp`.
- **Alt texts and captions follow the shot list**, since no photograph is chosen yet. Each must be checked against the photograph once it is.
- **Style.** British English. Per cent without a space, `38%`, as the other pages have it. Straight apostrophes, as typed. Units after an ordinary space; the build may make that space U+00A0, which the format allows.

## The site's own types

### `case-study`

Address `/customers/{slug}/`, collection `case-studies`. The fields, in this order:

| Field | Type | Control | Label | Notes |
|---|---|---|---|---|
| `date` | core | | | Published |
| `modified` | core | | | Last changed |
| `image` | core | | | Main image, from the `case-…` pictures |
| `headline` | core | | | What the case shows, in one line; the page's H1 |
| `standfirst` | core | | | Two sentences under the headline |
| `excerpt` | core | | | The text of the case's teaser in lists |
| `customer` | `string` | `text` | Customer | The customer's name as `design/README.md` gives it |
| `industry` | `string` | `select` | Industry | `Logistics and warehousing`, `Manufacturing`, `Retail and commercial property`: the three industry pages |
| `location` | `string` | `text` | Location | Town or region, and country |
| `built` | `string` | `text` | What we built | Short: "Rooftop solar and depot charging" |
| `solarCapacity` | `number` | `number` | Solar capacity, MWp | Left out where there is none |
| `storageCapacity` | `number` | `number` | Storage capacity, MWh | Left out where there is none |
| `chargePoints` | `integer` | `number` | Charge points | Left out where there are none |
| `contract` | `string` | `select` | How it was paid for | `Bought outright`, `Power purchase agreement` |
| `inService` | `date` | `date` | In service since | The day the last part went into service |
| `featured` | `boolean` | `toggle` | Featured | The home page lists the case with `where="featured=true"`; Norrvik Logistics alone is `true` |
| `topics` | `{ "taxonomy": "topics" }` | | Topics | The article's built-in topics, so that the customers page can filter by them and the Pilot page can list `include="topics:reporting"` |
| `seo` | core | | | Not set in these files |

Structured data types: `["Article"]`. Body elements: `paragraph`, `heading`, `list`, `quote`, `table`, `footnotes`, `image`, `gallery`, and the design system's `aside` and `eyebrow`.

### `job`

Address `/about/careers/{slug}/`, collection `jobs`. The fields, in this order:

| Field | Type | Control | Label | Notes |
|---|---|---|---|---|
| `date` | core | | | Published |
| `modified` | core | | | Last changed |
| `excerpt` | core | | | One sentence on the work, for the card on the careers page |
| `location` | `string` | `select` | Office | `Gothenburg`, `Malmö`, `Rotterdam`, `Leeds` |
| `team` | `string` | `text` | Team | Such as `Engineering and Delivery` or `Energy Services` |
| `employment` | `string` | `select` | Employment | `Permanent, full time`, `Permanent, part time`, `Fixed term` |
| `closingDate` | `date` | `date` | Last day to apply | Every one after 12 November 2026 |
| `seo` | core | | | Not set in these files |

Structured data types: none of the core's fits a vacancy (see Wishes). Body elements: `paragraph`, `heading`, `list`, and the design system's `list-directive`, for the actions under "How to apply".

## The showpiece and the scheduled article

- **The showpiece** is `articles/can-your-roof-carry-solar-panels.md`, by Priya Raman. Its body holds crossheads at level 2 with four at level 3 under one of them, a bulleted list, a numbered list, a quotation with its source, a simple table, a picture with a caption, three footnotes and a fact box.
- **The case study drawn in full** is `case-studies/norrvik-logistics.md`: a gallery of `case-norrvik-roof`, `case-norrvik-charging`, `case-norrvik-inverters` and `case-norrvik-team`, each with its caption and the gallery's own, a structured table with a caption and a footer, a fact box and a quotation.
- **The scheduled article** is `articles/grid-capacity-is-now-the-scarce-resource.md`, dated 1 December 2026 at 07:00 UTC. As a content file it cannot exist before that day, since a build writes only a post whose date has come. In the source repository it is a source file with `status: scheduled` and that date, so that the editor shows it as scheduled and it goes live on its own.

## Every post

| Date | Post | Type | Author | Category | Topics |
|---|---|---|---|---|---|
| 2026-04-21 | Lindhagen Furniture | case study | | | financing, solar |
| 2026-05-19 | Brantevik Foods | case study | | | solar, storage |
| 2026-06-16 | On-site solar in your sustainability report | article | Lena Bergqvist | Market and policy | reporting, solar |
| 2026-07-14 | Who carries what in a power purchase agreement | article | Elias Forsberg | Guides | financing, solar |
| 2026-08-18 | What fire safety a battery needs | article | Priya Raman | Guides | storage |
| 2026-08-25 | Norrvik Logistics | case study | | | charging, reporting, solar |
| 2026-09-08 | Charging a fleet on a limited grid connection | article | Hannah Whitcombe | Guides | charging, grid |
| 2026-09-24 | The last Westerport roof goes live | article | Hannah Whitcombe | Company news | charging, reporting, solar |
| 2026-10-13 | Can your roof carry solar panels? (showpiece) | article | Priya Raman | Guides | solar |
| 2026-10-20 | Westerport Retail Parks | case study | | | charging, reporting, solar |
| 2026-10-21 | Field Service Technician, Leeds, closes 2026-11-30 | job | | | |
| 2026-10-28 | Ampfield Pilot now steers the loads that can wait | article | Elias Forsberg | Company news | grid, storage |
| 2026-11-02 | Electrical Design Engineer, Gothenburg, closes 2026-12-06 | job | | | |
| 2026-11-04 | Does solar pay in a northern winter? | article | Lena Bergqvist | Market and policy | financing, solar |
| 2026-11-09 | Project Manager, Rotterdam, closes 2026-12-13 | job | | | |
| 2026-12-01 | Grid capacity is now the scarce resource (scheduled) | article | Lena Bergqvist | Market and policy | grid, storage |

Among the eight articles published by 12 November, every category, topic and author has at least two; the scheduled one adds a third to Lena Bergqvist, Market and policy, Grid and Storage.

## Facts added to `design/README.md`

The texts keep to the README's facts and to what the other pages already say, such as the FAQ's terms for a power purchase agreement and the roof survey, the fleet charging page's figures for vans and trucks, and Karin Öberg's "about 60,000 m²" on the logistics page. They add these, which other pages should not contradict:

- **Norrvik Logistics:** centres in Jönköping, Örebro, Norrköping, Borås, Helsingborg and Eskilstuna; built April 2024 to 12 June 2025; 21,860 panels, 78 string inverters; 184 charge points of 11 kW for vans and 28 of up to 150 kW for trucks; bought outright; first full year 8.3 GWh, 7.1 GWh used on site, of 18.7 GWh in all; the Borås roof re-roofed in 2012, its panels moved to the 2016 extension.
- **Brantevik Foods:** plant and cold store in Tomelilla, cold store in Kristianstad; 1.9 and 1.2 MWp; a 2 MW, 4 MWh battery 14 metres from the Tomelilla cold store; bought outright; in service 11 April 2025; peak 2.6 MW to 1.9 MW; set point lowered from −25 °C to −28 °C on solar power.
- **Lindhagen Furniture:** in Värnamo since 1961, third generation; 5.9 GWh a year; 1.91 GWh from the roof in its first year, 1.83 GWh used; in service 28 March 2025; capital kept for a CNC machining line, in production October 2025.
- **Westerport Retail Parks:** eleven parks from Teesside to South Yorkshire, 168 tenants, 74 roofs, about 15,800 panels; 280 charge points of 22 kW and 60 of up to 150 kW; February 2025 to 18 September 2026, the last park near Doncaster; bought outright, maintained by the Leeds office for ten years; no trading day lost.
- **Ampfield:** 214 roof surveys in 2025; about a third of 2025's solar systems sold under a power purchase agreement; batteries since 2018, lithium iron phosphate since 2021; Pilot's update of 3 November 2026 adds flexible loads and hourly limits.
- **Telephone numbers:** Priya Raman +46 31 390 06 12; Hannah Whitcombe +44 113 496 0412, from the same series reserved for drama as the Leeds office's number.

## Assumptions about directive syntax

Konzilo Design's `docs/spec/directives.md` records what each directive renders, not how it is written. These are the readings used here, together with `content-format.md`'s syntax for directives, and the same as the other copy agent's pages where both use a directive.

1. **A fact box** is the container `:::aside{anchor="…"}`, with a blank line after its opening fence and before its closing `:::`. Its `anchor` becomes the box's `id`, which makes it a stop in an article's following menu ("with its `anchor` as `id`"; `section` takes `anchor` the same way). It takes no `surface`, since `surfaceOf('fact-box')` gives its Surface. Three colons are enough because it holds only a leaf directive.
2. **Inside a fact box** come `::eyebrow[…]`, the leaf with a text body, as the label; then the heading at level 2, `## …`, since the markup shows `h2.kn-fact-box-heading` and headings keep the level they are written at; then paragraphs and a list. The heading is assumed not to count as a crosshead of the article, so the menu shows the box once, by its heading.
3. **Actions** are `:::list{type="actions"}` around one Markdown list whose items are each one link, the main action's link in bold, `- **[Apply by e-mail](mailto:…)**`.
4. **An article's body holds no hero or section.** Its page is laid out from its fields; the body is a lede and sections under level-2 crossheads.
5. **The body of a case study or a vacancy** is written the same way, a lede and sections, with no hero or section directive. That reads well whether the design gives these types an article's reading column or a page's bands, where blocks outside a section stand in one without a Surface.
6. **Crossheads carry no explicit anchor**, since the reader gives each heading an id.

## Wishes the elements cannot meet

Each used the nearest element that exists. They belong in `design/gaps.md`.

- **Key figures in a case study.** Large numbers such as 9.4 MWp, 212 and 38% have no directive; directives.md names a Key Figures component but gives it no directive. Instead the figures are typed fields, `solarCapacity`, `storageCapacity` and `chargePoints`, which a template can show as key figures, and the fact box lists the first year's results.
- **A vacancy as `JobPosting`.** A type of the site's own may only offer the seven structured data types the core knows, and none of them describes a vacancy. `closingDate`, `location` and `employment` would fill `validThrough`, `jobLocation` and `employmentType`.
- **An author's portrait.** An author term holds a name and a biography only, so neither the byline nor the author's page can take `portrait-<slug>` from the content. A template could find it by the author's slug.
- **A source under a table.** A footnote mark may not stand in a table, and a simple table has no caption, so each table's source is a footnote on the paragraph before it. The Norrvik table is a structured table, so its caption says what it holds.
- **A dedicated picture for the showpiece's body.** It uses `rooftop-detail`, which the Rooftop solar page also uses. A picture of its own would be better: `article-roof-ballast`, a close view of an east–west system's mounting rails, protective pads and ballast blocks on a membrane roof.
