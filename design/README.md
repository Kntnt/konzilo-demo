# The design

What the demo site shows, who the fictional company is, and which pages are designed. Everything made in the design phase follows this file.

## Folders

| Folder | Holds |
|---|---|
| `site.design.json` | The design file, made with Konzilo Design |
| `logo/` | Ampfield's logos, and the logos of its fictional customers |
| `fonts/` | The typefaces the design uses, as `konzilo-design fonts` copies them |
| `export/` | What Konzilo Design exports from the design file: the export for agents (`design-md/` and its ZIP), the presentation's ZIP, and four pictures of the design in `preview/`. `design-md`, `design-presentation` and `fonts` run only from Konzilo Design's repository (`~/Projects/konzilo-design/bin/`), not from the package |
| `content/` | The text of every page, in Konzilo's Markdown |
| `images/` | The pictures, with `credits.json` |
| `mockups/` | Every designed page, built as static HTML from the design system's own components |

## The company

**Ampfield Energy AB** ("Ampfield") designs, builds, finances and operates on-site energy systems for industrial and commercial properties. It is fictional.

- **Offer:** rooftop solar, battery storage, fleet charging, and the energy management software Ampfield Pilot. A customer buys a system outright, or pays nothing up front and buys the power at a fixed price under a power purchase agreement, in which Ampfield owns and runs the system.
- **Buyers:** operations, property and finance managers of manufacturers, logistics companies and owners of retail and commercial property.
- **Founded:** 2014, in Gothenburg. **Offices:** Gothenburg (head office), Malmö, Rotterdam and Leeds. **Works in:** Sweden, Denmark, the Netherlands and the United Kingdom.
- **Figures:** 140 employees, 610 sites, 420 MWp of solar, 95 MWh of storage, 3,800 charge points.
- **Slogan:** On-site energy for industry.
- **Head office:** Fältverksgatan 6, 417 64 Gothenburg, Sweden, a street that does not exist. **Registration number:** 559214-3871, which fails the checksum of a real one. **VAT number:** SE559214387101.
- **Addresses:** e-mail at `ampfield.example`; telephone numbers only from series reserved for fiction (Sweden: 031-390 06 00 to 99); street names that do not exist in their towns.
- **Rules of thumb** every page and article keeps to (settled where the texts disagreed, `feedback.md` 24 to 28):
  - A solar system bought outright pays for itself in 6 to 9 years where at least 80% of its output is used on site: 7 to 9 in Sweden and Denmark, 6 to 8 in the Netherlands and the United Kingdom, 6 to 8 for a 1 MWp roof.
  - An east–west roof gives 850 to 910 kWh a year for each kWp in the four countries (Ampfield's model, Gothenburg 870, Malmö 910, Rotterdam 900, Leeds 850); 850 to 1,000 holds for rooftop solar of every kind, south-facing rows giving about a tenth more per panel.
  - An east–west system takes about 6,500 to 7,000 m² of roof for each MWp: 10,000 m² holds about 1.5 MWp, 30,000 m² about 4.5 MWp.
  - Ampfield Pilot steers batteries, chargers and heat pumps, and since its update of 3 November 2026 the loads a customer marks as flexible: cold stores, air compressors and water heaters.
  - A battery bought for peak shaving pays for itself in 6 to 9 years on grid fees alone, 5 to 7 with income from the grid. Kessel Packaging's is the exception: bought to avoid a larger connection, it pays back in about 14 years on its fees, and in about 5 counted against the connection it replaced.

### People

| Name | Role | Writes articles |
|---|---|---|
| Ingrid Sandell | Chief Executive Officer | |
| Mattias Lönn | Chief Technology Officer | |
| Priya Raman | Head of Engineering and Delivery | yes |
| Elias Forsberg | Head of Energy Services | yes |
| Sofia Marklund | Chief Financial Officer | |
| Daniel Okafor | Head of People and Safety | |
| Joost van der Heiden | Country Manager, Netherlands | |
| Hannah Whitcombe | Country Manager, United Kingdom | yes |
| Lena Bergqvist | Energy Market Analyst | yes |

### Customers

Every page that names a customer keeps to these facts.

| Name | Business | What Ampfield built | Result | Speaks for it |
|---|---|---|---|---|
| Norrvik Logistics | Third-party logistics; six distribution centres in Sweden, the largest in Jönköping | 9.4 MWp of rooftop solar and 212 depot charge points for vans and trucks | Solar covers 38 % of its yearly electricity | Karin Öberg, Head of Property |
| Brantevik Foods | Food producer with cold stores; two sites in Skåne | 3.1 MWp of rooftop solar and a 4 MWh battery | Peak demand cut by 27 %; the cold stores pre-cool on solar power | Nils Thulin, Operations Director |
| Lindhagen Furniture | Furniture factory in Värnamo | 2.2 MWp of rooftop solar under a 15-year power purchase agreement | 31 % of its electricity, with nothing paid up front | Maria Lindhagen, Chief Executive |
| Westerport Retail Parks | Eleven retail parks in the north of England | 6.8 MWp of rooftop solar and 340 charge points for visitors | Solar covers the parks' landlord supply in daytime | James Holroyd, Head of Sustainability |
| Kessel Packaging | Packaging plant in Dordrecht | A 5 MWh battery for peak shaving | Grid fees cut by 22 %, and a larger grid connection avoided | Marieke de Wit, Plant Manager |

Four have a case study: Norrvik Logistics, Brantevik Foods, Lindhagen Furniture and Westerport Retail Parks.

## The brand

- **Colours:** a deep green as the primary colour, and a warm amber as the secondary. The design file holds the exact values.
- **Type:** Konzilo Design's own choice for a new design, Mona Sans with Mona Sans Mono.
- **Everything else:** Konzilo Design's defaults, unless a default plainly fails this site or Thomas asked otherwise (`feedback.md`): the header without its link menu, at the window's edge, sliding away and translucent; the footer at the window's edge, revealed by the page, which casts its shadow on it, and the text of its right column set at the column's end; the rule across the tabs above them; shadows; corners of 3 px; and the first heading and the display style light and a little narrow, as display type.
- **Voice:** plain and concrete, written by engineers for people who run buildings and budgets. British English. Figures over adjectives. No hype.

## The site

One language, British English.

| Address | Page | Type | Designed |
|---|---|---|---|
| `/` | Home | page | yes, and at phone width |
| `/solutions/` | Solutions | page | yes |
| `/solutions/rooftop-solar/` | Rooftop solar | page | yes, and at phone width |
| `/solutions/battery-storage/` | Battery storage | page | as Rooftop solar |
| `/solutions/fleet-charging/` | Fleet charging | page | as Rooftop solar |
| `/solutions/ampfield-pilot/` | Ampfield Pilot | page | as Rooftop solar |
| `/industries/` | Industries | page | as Solutions |
| `/industries/logistics/` | Logistics and warehousing | page | yes |
| `/industries/manufacturing/` | Manufacturing | page | as Logistics and warehousing |
| `/industries/retail/` | Retail and commercial property | page | as Logistics and warehousing |
| `/customers/` | Customers, the list of all case studies, reached from the industry pages and the case studies' trails; not in the menu | page with a post list | yes |
| `/customers/{slug}/` | A case study, four of them | the site's own type `case-study` | yes, Norrvik Logistics |
| `/insights/` | Insights | page with a post list | yes |
| `/insights/{slug}/` | An article, twenty-one of them, one dated 1 December 2027 and so scheduled, which the site leaves out until then | article | yes, one, and at phone width |
| `/insights/category/{slug}/` | A category | term page | yes, one |
| `/insights/topic/{slug}/` | A topic | term page | as a category |
| `/insights/author/{slug}/` | An author | term page | yes, one |
| `/about/` | About us | page | yes |
| `/about/team/` | Team | page | yes |
| `/about/careers/` | Careers | page with a post list | yes |
| `/about/careers/{slug}/` | A vacancy, three of them | the site's own type `job` | yes, one |
| `/contact/` | Contact, with the form `contact` | page | yes, and at phone width |
| `/faq/` | Questions and answers | page | yes |
| `/privacy-policy/` | Privacy policy | page | yes |
| `/cookie-policy/` | Cookie policy | page | as Privacy policy |
| `/accessibility/` | Accessibility statement | page | as Privacy policy |
| `/search/` | Search results | the core's search page | yes |
| any other | Page not found | the 404 page | yes |
| `/go/site-assessment/` | Book a site assessment, with the form `assessment` | canvas, with no header and footer | yes |

Also designed: the header with its menu open, with its search box open, and come back over a scrolled page, and the footer revealed at the end of a page, at desktop and phone width.

Categories: Guides, Market and policy, Company news. Topics: Solar, Storage, Charging, Financing, Grid, Reporting.

### The menu

| Level 1 | Level 2, each with a line of description |
|---|---|
| Solutions | Rooftop solar, Battery storage, Fleet charging, Ampfield Pilot |
| Industries | Logistics and warehousing, Manufacturing, Retail and commercial property |
| Insights | Guides, Market and policy, Company news |
| About | About us, Team, Careers, Contact |

Customers is no section of its own (Thomas, 2026-11-12): each industry page lists the case studies of its industry, and the case studies keep their addresses under `/customers/` and Customers as their trail's top level. The menu reaches the header's megamenu only: the header shows no link menu, only the menu button, the search and its call to action, "Book a site assessment".

### The footer

Konzilo Design's own arrangement and sample content, with Ampfield's words: the brand, the social links, one sentence about the company, the top level of the menu, the address, the legal pages, and the consent links. Beside the address stand three lines: "Registered office: Gothenburg", "Ampfield Energy is a fictional company." and "This site demonstrates Konzilo.", the word Konzilo a link to Konzilo's site, `https://www.konzilo.com/`. On a wide screen they end at the column's end, flush with the consent links under them. The registration and VAT numbers are not shown.

The footer lies still at the window's bottom edge, under the page, which scrolls off it and casts its shadow on it; scrolled to the end, it stands where a footer at the page's end would.

## Rules for every page

1. **Only what can be rendered.** A page uses only what Konzilo Design's components and its contract for Konzilo's directives (`docs/spec/directives.md` in Konzilo Design) can render, placed as an editor could place it. Where a page wants more, it takes the nearest thing that exists, and the wish goes into `gaps.md` in this folder.
2. **No nesting inside items.** Tabs, accordions and cards hold text, lists and pictures, never a form, a post list or another component.
3. **Real words.** No placeholder text. Invented facts stay within the company described above, and agree across pages.
4. **Credited pictures.** Each picture is free to use in a public demo, and recorded in `images/credits.json`.
