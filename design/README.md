# The design

What the demo site shows, who the fictional company is, and which pages are designed. Everything made in the design phase follows this file.

## Folders

| Folder | Holds |
|---|---|
| `site.design.json` | The design file, made with Konzilo Design |
| `logo/` | Ampfield's logos, and the logos of its fictional customers |
| `fonts/` | The typefaces the design uses, as `konzilo-design fonts` copies them |
| `export/` | What Konzilo Design exports from the design file |
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
- **Addresses:** e-mail at `ampfield.example`; telephone numbers only from series reserved for fiction (Sweden: 031-390 06 00 to 99).

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
| Brantevik Foods | Food producer with cold stores; two sites in Skåne | 3.1 MWp of rooftop solar and a 4 MWh battery | Peak demand cut by 27 %; the cold stores pre-cool on solar power | Anders Thulin, Operations Director |
| Lindhagen Furniture | Furniture factory in Värnamo | 2.2 MWp of rooftop solar under a 15-year power purchase agreement | 31 % of its electricity, with nothing paid up front | Maria Lindhagen, Chief Executive |
| Westerport Retail Parks | Eleven retail parks in the north of England | 6.8 MWp of rooftop solar and 340 charge points for visitors | Solar covers the parks' landlord supply in daytime | James Holroyd, Head of Sustainability |
| Kessel Packaging | Packaging plant in Dordrecht | A 5 MWh battery for peak shaving | Grid fees cut by 22 %, and a larger grid connection avoided | Marieke de Wit, Plant Manager |

Four have a case study: Norrvik Logistics, Brantevik Foods, Lindhagen Furniture and Westerport Retail Parks.

## The brand

- **Colours:** a deep green as the primary colour, and a warm amber as the secondary. The design file holds the exact values.
- **Type:** Konzilo Design's own choice for a new design, Mona Sans with Mona Sans Mono.
- **Everything else:** Konzilo Design's defaults, unless a default plainly fails this site.
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
| `/customers/` | Customers | page with a post list | yes |
| `/customers/{slug}/` | A case study, four of them | the site's own type `case-study` | yes, Norrvik Logistics |
| `/insights/` | Insights | page with a post list | yes |
| `/insights/{slug}/` | An article, nine of them | article | yes, one, and at phone width |
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

Also designed: the header with its menu open, and with its search box open, at desktop and phone width.

Categories: Guides, Market and policy, Company news. Topics: Solar, Storage, Charging, Financing, Grid, Reporting.

### The menu

| Level 1 | Level 2, each with a line of description |
|---|---|
| Solutions | Rooftop solar, Battery storage, Fleet charging, Ampfield Pilot |
| Industries | Logistics and warehousing, Manufacturing, Retail and commercial property |
| Customers | |
| Insights | Guides, Market and policy, Company news |
| About | About us, Team, Careers, Contact |

The header's call to action is "Book a site assessment".

### The footer

Konzilo Design's own arrangement and sample content, with Ampfield's words: the brand, the social links, one sentence about the company, the top level of the menu, the address, the registration line, the legal pages, and the consent links. A line says that the company is fictional and that the site demonstrates Konzilo.

## Rules for every page

1. **Only what can be rendered.** A page uses only what Konzilo Design's components and its contract for Konzilo's directives (`docs/spec/directives.md` in Konzilo Design) can render, placed as an editor could place it. Where a page wants more, it takes the nearest thing that exists, and the wish goes into `gaps.md` in this folder.
2. **No nesting inside items.** Tabs, accordions and cards hold text, lists and pictures, never a form, a post list or another component.
3. **Real words.** No placeholder text. Invented facts stay within the company described above, and agree across pages.
4. **Credited pictures.** Each picture is free to use in a public demo, and recorded in `images/credits.json`.
