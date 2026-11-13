# Editorial content

The site's articles, case studies and vacancies, and the terms that sort them: what each file holds, the two post types of the site's own that they need, and the assumptions made where neither Konzilo nor Konzilo Design records the exact Markdown.

| Folder | Holds |
|---|---|
| `articles/` | Twenty-one articles, the core's type `article` |
| `case-studies/` | Four case studies, the site's own type `case-study` |
| `jobs/` | Three vacancies, the site's own type `job` |
| `authors/`, `categories/`, `topics/` | The terms of the article's three built-in taxonomies |

## The form of the files

- **Content-file form.** Each post is front matter and a body as `content-format.md` gives a content file: the keys in the order the type declares them, every value on one line, a text, list or object as JSON, a moment and a day unquoted. The terms are JSON as `JSON.stringify(value, null, 2)` writes them.
- **Pictures by id.** A picture in a body is `![alt](image:<id>)`, and a post's main image is `image: {"src":"image:<id>","alt":"…"}`, each id from `design/images/shot-list.md`. The build replaces `image:<id>` with the master's path, `../media/<slug>-<hash>.webp`.
- **Alt texts and captions say what the photograph shows**, as `design/images/credits.json` describes it, checked against each picture on 12 November 2026. A caption tells what the text needs but claims nothing the picture does not show. One of Norrvik's pictures differs from what the text says was built: `case-norrvik-team` shows panels fitted on a profiled sheet roof, where the text has a ballasted system on membrane roofs. No better picture was found, so its alt text and caption say what it shows and no more.
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
| `closingDate` | `date` | `date` | Last day to apply | Every one a year on, after 12 November 2027, so that the demo shows open vacancies for a year; each text says that applications are read as they come in |
| `seo` | core | | | Not set in these files |

Structured data types: none of the core's fits a vacancy (see Wishes). Body elements: `paragraph`, `heading`, `list`, and the design system's `list-directive`, for the actions under "How to apply".

## The showpiece and the scheduled article

- **The showpiece** is `articles/can-your-roof-carry-solar-panels.md`, by Priya Raman. Its body holds crossheads at level 2 with four at level 3 under one of them, a bulleted list, a numbered list, a quotation with its source, a simple table, a picture with a caption, three footnotes, a fact box, and an embedded video, so that the core's consent placeholder shows: the Edinburgh Fire Research Centre's presentation "Experimental Study of Flame Spread Underneath Photovoltaic (PV) Modules" (University of Edinburgh, 2021), `https://www.youtube.com/watch?v=PwmzZ26vEYU`, under "Where can panels not go?".
- **The case study drawn in full** is `case-studies/norrvik-logistics.md`: a gallery of `case-norrvik-roof`, `case-norrvik-charging` and `case-norrvik-inverters`, each with its caption and the gallery's own, a picture of its own, `case-norrvik-team`, with its caption under the works, a structured table with a caption and a footer, a fact box and a quotation. The gallery holds three, since the design sets a gallery's columns by the width and not by the number of pictures: in the reading column it has three, and four would leave one alone on a second row.
- **The scheduled article** is `articles/grid-capacity-is-now-the-scarce-resource.md`, dated 1 December 2027 at 07:00 UTC, a year on, so that the editor shows a scheduled post for a year. As a content file it cannot exist before that day, since a build writes only a post whose date has come. In the source repository it is a source file with `status: scheduled` and that date, so that the editor shows it as scheduled and it goes live on its own.

## Every post

| Date | Post | Type | Author | Category | Topics |
|---|---|---|---|---|---|
| 2026-01-13 | What a solar roof costs in 2026 | article | Priya Raman | Market and policy | financing, solar |
| 2026-01-27 | A year of charging at Norrvik's Jönköping depot | article | Elias Forsberg | Company news | charging, reporting |
| 2026-02-10 | Your electric fleet in your emissions report | article | Lena Bergqvist | Market and policy | charging, reporting |
| 2026-02-24 | We now ask the grid before we make an offer | article | Priya Raman | Company news | grid, solar |
| 2026-03-10 | Depot chargers in a leased warehouse | article | Hannah Whitcombe | Guides | charging, financing |
| 2026-03-24 | What a solar roof needs in thirty years | article | Elias Forsberg | Guides | solar |
| 2026-04-14 | What a battery earns beyond peak shaving | article | Lena Bergqvist | Guides | grid, storage |
| 2026-04-21 | Lindhagen Furniture | case study | | | financing, solar |
| 2026-05-05 | Which meters a site needs | article | Priya Raman | Guides | charging, reporting |
| 2026-05-19 | Brantevik Foods | case study | | | solar, storage |
| 2026-05-26 | Kessel Packaging's battery after its first year | article | Lena Bergqvist | Company news | financing, storage |
| 2026-06-02 | When the power price goes below zero | article | Elias Forsberg | Market and policy | grid, solar |
| 2026-06-16 | On-site solar in your sustainability report | article | Lena Bergqvist | Market and policy | reporting, solar |
| 2026-07-14 | Who carries what in a power purchase agreement | article | Elias Forsberg | Guides | financing, solar |
| 2026-07-28 | Selling a building with solar on the roof | article | Hannah Whitcombe | Guides | financing, solar |
| 2026-08-18 | What fire safety a battery needs | article | Priya Raman | Guides | storage |
| 2026-08-25 | Norrvik Logistics | case study | | | charging, reporting, solar |
| 2026-09-08 | Charging a fleet on a limited grid connection | article | Hannah Whitcombe | Guides | charging, grid |
| 2026-09-24 | The last Westerport roof goes live | article | Hannah Whitcombe | Company news | charging, reporting, solar |
| 2026-10-13 | Can your roof carry solar panels? (showpiece) | article | Priya Raman | Guides | solar |
| 2026-10-20 | Westerport Retail Parks | case study | | | charging, reporting, solar |
| 2026-10-21 | Field Service Technician, Leeds, closes 2027-11-30 | job | | | |
| 2026-10-28 | Ampfield Pilot now steers the loads that can wait | article | Elias Forsberg | Company news | grid, storage |
| 2026-11-02 | Electrical Design Engineer, Gothenburg, closes 2027-12-06 | job | | | |
| 2026-11-04 | Does solar pay in a northern winter? | article | Lena Bergqvist | Market and policy | financing, solar |
| 2026-11-09 | Project Manager, Rotterdam, closes 2027-12-13 | job | | | |
| 2026-11-10 | Fast chargers are outgrowing their connections | article | Hannah Whitcombe | Market and policy | charging, storage |
| 2027-12-01 | Grid capacity is now the scarce resource (scheduled) | article | Lena Bergqvist | Market and policy | grid, storage |

Twenty of the twenty-one articles are published by 12 November, the newest three on 10 November, 4 November and 28 October. Among those twenty, each author has five; Guides has nine, Market and policy six and Company news five; Solar is on ten, Charging on seven, Financing on six, and Grid, Reporting and Storage on five each. Every pair of choices across the filters, an author with a category, an author with a topic, or a category with a topic, finds at least one published article. The scheduled article adds a sixth to Lena Bergqvist and to Grid and Storage, and a seventh to Market and policy.

## Facts added to `design/README.md`

The texts keep to the README's facts and to what the other pages already say, such as the FAQ's terms for a power purchase agreement and the roof survey, the fleet charging page's figures for vans and trucks, and Karin Öberg's "about 60,000 m²" on the logistics page. They add these, which other pages should not contradict:

- **Norrvik Logistics:** centres in Jönköping, Örebro, Norrköping, Borås, Helsingborg and Eskilstuna; built April 2024 to 12 June 2025; 21,860 panels, 78 string inverters; 184 charge points of 11 kW for vans and 28 of up to 150 kW for trucks; bought outright; first full year 8.3 GWh, 7.1 GWh used on site, of 18.7 GWh in all; the Borås roof re-roofed in 2012, its panels moved to the 2016 extension.
- **Brantevik Foods:** plant and cold store in Tomelilla, cold store in Kristianstad; 1.9 and 1.2 MWp; a 2 MW, 4 MWh battery 14 metres from the Tomelilla cold store; bought outright; in service 11 April 2025; peak 2.6 MW to 1.9 MW; set point lowered from −25 °C to −28 °C on solar power.
- **Lindhagen Furniture:** in Värnamo since 1961, third generation; 5.9 GWh a year; 1.91 GWh from the roof in its first year, 1.83 GWh used; in service 28 March 2025; capital kept for a CNC machining line, in production October 2025.
- **Westerport Retail Parks:** eleven parks from Teesside to South Yorkshire, 168 tenants, 74 roofs, about 15,800 panels; 280 charge points of 22 kW and 60 of up to 150 kW; February 2025 to 18 September 2026, the last park near Doncaster; bought outright, maintained by the Leeds office for ten years; no trading day lost.
- **Ampfield:** 214 roof surveys in 2025; about a third of 2025's solar systems sold under a power purchase agreement; batteries since 2018, lithium iron phosphate since 2021; Pilot's update of 3 November 2026 adds flexible loads and hourly limits.
- **Telephone numbers:** Priya Raman +46 31 390 06 12; Hannah Whitcombe +44 113 496 0412, from the same series reserved for drama as the Leeds office's number.

The twelve articles from January to November 2026 add these:

- **Norrvik Logistics, Jönköping:** 52 charge points of 11 kW for vans and 12 chargers of up to 150 kW for trucks; the fleet there grew from 38 vans and 6 trucks in October 2024 to 52 vans and 11 trucks in September 2025; in that year 1.04 GWh charged, 0.41 GWh into vans and 0.63 GWh into trucks, 11% of it from the roof, and 44% of the trucks' noon top-ups from April to September; a van took 0.23 kWh per km in June and 0.28 in January, and preconditions on the charger; the coldest night −19 °C; highest demand 2.09 MW, 95% of the connection; chargers 99.2% available, 37 faults, 21 cleared remotely, cable holders fitted after vans ran over cables; Norrvik's report for 2025 is its first with fleet electricity per vehicle.
- **Kessel Packaging:** the new line is a printing and die-cutting line; the operator offered a reinforcement of €1.1 million in three years; signed with the Rotterdam office in October 2024, running in March 2025, the line started in June 2025 and now runs two shifts; the battery is 2.5 MW in two containers, cost €1.7 million, and Pilot holds the plant's draw at 2.9 MW; agreed capacity lowered from 3.6 MW to 3.2 MW in May 2025; April 2025 to March 2026 against the year before: 17.6 GWh used (15.1), monthly peak 2.92 MW on average (3.30), highest 3.14 MW (3.52), grid fees €421,000 (€540,000); about 190 full cycles, 99.6% available; none of it offered to the grid.
- **Westerport Retail Parks:** January to October 2026, 1.55 GWh charged, 0.45 GWh from the 22 kW chargers and 1.10 GWh from the fast chargers; fast chargers in use 15% of opening hours and 42% on Saturday afternoons, over 80% at the three busiest parks, where Pilot then holds them to about 70 kW; at the five parks with fast chargers through both summers, June to August energy rose 64% from 2025 to 2026; the battery study at three parks is to be finished in December 2026.
- **Ampfield, its work:** 112 solar systems designed in 2025, of which 19 changed after the operator answered (14 export limits, 5 made smaller, seven weeks on average); from 2 March 2026 a capacity enquiry at every site assessment; a fault in the existing metering at about one site in fifteen of 2025's assessments; 23 buildings with Ampfield systems sold since 2019.
- **Ampfield, its systems:** a 1 MWp roof priced at €670,000 in January 2026, line by line in `what-a-solar-roof-costs-in-2026.md`; panels about 435 W, €120,000 per MWp against €270,000 in 2022; faults and outages cost 1.6% of possible output in 2025, half of it inverters; about one panel in 2,500 replaced; the service agreement includes the washes; gull mesh on coastal roofs; roofs inspected within a week of gusts above 25 m/s; new inverters €50,000 to €60,000 per MWp.
- **Ampfield Pilot:** has held back export in hours of negative prices since spring 2024, about 2,700 MWh in 2025, 0.8% of output, saving owners about €110,000; offers customers' batteries to the reserve markets together.

## Assumptions about directive syntax

When the texts were written, Konzilo Design's `docs/spec/directives.md` recorded what each directive renders, not how it is written. These are the readings used here, together with `content-format.md`'s syntax for directives, and the same as the other copy agent's pages where both use a directive. Since 0.7.0 Konzilo Design records each directive's attributes in `src/directives/components.json`, the core's intake checks every body against them, and the texts pass it.

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
