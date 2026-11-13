# Gaps

What the design phase wanted and could not have, and the faults it found on the way. Each entry ends as a fix in the repository it belongs to, and leaves this file once the fix is released and a page that wanted it uses it; until then it is recorded here, with the open issue that asks for it where one is filed.

## What a page wanted and the directives could not render

| Wish | Where | Used instead |
|---|---|---|
| Key figures as large numbers | Home, About us, the industries | The value list, `:::list{type="values"}`; Kntnt/konzilo-design#15 |
| A history marked by years | About us | A description list with the years as terms; the timeline only numbers its steps; Kntnt/konzilo-design#15 |
| A customer's words set large, with name and role | The industries, Careers | A quotation with `<cite>`; the Quotation component has no directive; Kntnt/konzilo-design#20 |
| A call-to-action band | Every marketing page | A section on the `accent` Surface with a heading and actions; the CTA Band component has no directive; Kntnt/konzilo-design#15 |
| The control for objecting to the counting of visits, placed in a page | Privacy policy | Nothing: the site counts no visits, and the policy says so; Kntnt/konzilo#82 |
| Case studies filtered by solution | Customers | The `filtered` presentation's rows of topics and search; the solutions are no taxonomy, and the topics Solar, Storage and Charging stand in for three of them |
| Related case studies on a page | The solutions, the industries | One case study picked by hand on each solution, `where="industry=…"` on each industry; a page carries no terms, so `order="related"` has nothing to go by; Kntnt/konzilo#78 |
| A featured post on the first page of a paged list only | Insights | The featured list repeats on every page; Kntnt/konzilo#77 |
| A button text of the form's own | Book a site assessment | The core's "Send": Konzilo 0.5.0 lets a form have its own, and this form sets none yet |
| The header's call to action in the design tool's preview | The design file | The preview and the presentation always say "Contact"; Kntnt/konzilo-design#8 |
| Key figures at the top of a case study | The case studies | Number fields of the type, as a value list in a fact box beside the body; Kntnt/konzilo-design#15 |
| A vacancy marked up as a job posting for search engines | The vacancies | Nothing: a site's own type may offer only the structured data types the core knows; Kntnt/konzilo#80 |
| An author's portrait | The author's page, an article's byline | Nothing from content: an author term holds a name and a biography; Kntnt/konzilo#79 |
| A source under a simple table | The articles | A footnote on the paragraph before the table, or a structured table with a caption; Kntnt/konzilo#93 |
| A list of vacancies | A vacancy, under "Other vacancies" | A presentation `rows` of the site's own, made from the Content Loop; Konzilo Design's are `cards`, `featured` and `filtered`; Kntnt/konzilo-design#12 |
| A person's card with a portrait | Team | Ordinary cards with pictures cut to their wide format; the Card's `person` variant has no directive; Kntnt/konzilo-design#15 |
| Two options compared side by side under a head that is not centred | Home | A table. Konzilo Design 0.9.0 keeps a head over two cards at the start edge; the page has not taken it up |
| A list of one teaser that fills its row, such as a wide card with its picture beside the text | Logistics and warehousing, Retail and commercial property: each lists the one case study of its industry | The ordinary card, a third of the row, since a series of one card stands in three columns; Kntnt/konzilo-design#17 |
| A customer's words beside the teasers of that customer's case study | The industry pages | The quotation in a band of its own on `raised` after the list. Its reason, a head centred over two cards, went with Konzilo Design 0.9.0; the page has not taken it up |

## Faults and shortcomings in Konzilo Design

| What | How it shows |
|---|---|
| A hero's logo cannot follow the Surface it stands on | `.kn-hero-logo` is one picture that the editor chooses, while the header's logo changes with the mode; the light logo on a dark picture is hard to read; Kntnt/konzilo-design#2 |
| A picture behind a hero is an inline style, whose relative address resolves against the stylesheet's folder | `directives.md` allows the band's `--kn-picture-image` as the one inline style since 0.7.0, but says nothing of the address; `--kn-hero-screen` is not in `DESIGN.md`; Kntnt/konzilo-design#21 |
| A symbol cannot take the accent colour or follow the mode | Konzilo writes it as an `<img>`; Kntnt/konzilo-design#3 |
| The export for agents carries no stylesheet | `DESIGN.md` describes the look; no export bundles the real CSS of a site (the design's core, `konzilo.css`, the components, the font faces) as one file, so an agent can only rebuild it by hand; Kntnt/konzilo-design#5 |
| The icon files of the export and the components' icon set use different names | `brand-linkedin` and `triangle-exclamation-point` in the export; `linkedin` and `triangle-alert` in the set; Kntnt/konzilo-design#6 |
| A design resolved by an older generator passes `design-check` and `fromDesign` | A file resolved by 0.2.0 passes under 0.3.0, though 0.3.0 changed the dark-mode values; 0.11.0 says the same of its own warning colour; Kntnt/konzilo-design#7 |
| The header's call-to-action label cannot be set in a design | `project` has `menu` and `footer` but no field for it; Kntnt/konzilo-design#8 |
| The Logos list shows each logo as it is, in both modes | A one-colour logo must be a grey that holds on every ground, and is weak on `brand`, `accent` and `inverse`; Kntnt/konzilo-design#9 |
| `design-presentation` writes inside Konzilo Design's own folder | It rewrites ignored files under `presentation/.astro/` and uses `node_modules/.cache/`; Kntnt/konzilo-design#10 |
| The client's own footer words cannot carry a link | `project.footer` holds words or lists of words, so the tool's preview and the presentation show "This site demonstrates Konzilo." without its link; Kntnt/konzilo-design#11 |
| A type role cannot set its line height | A light first heading over two lines keeps `heading-1`'s 1.3, set for a heavy heading, and looks loose; `display` has 1.1; Kntnt/konzilo-design#13 |
| No output shows every component in the design's own colours and type | The presentation leaves out the directive components; the gallery shows them in the example design; Kntnt/konzilo-design#14 |
| Nothing turns a new Konzilo site into a designed one | Wiring the design into a site that `new-site` made is hand work after `konzilo.md`; the core's site template stays plain on purpose, so the way is Konzilo Design's to offer; Kntnt/konzilo-design#18 |

## Faults and shortcomings in Konzilo

| What | How it shows |
|---|---|
| Everything cannot run in one container | Since 0.5.0 each program finds its peers and its folders by settings, but the core offers no recipe for one container, so a site that wants one image writes its own Dockerfile and supervisor; Kntnt/konzilo#84 |
| Only the hostname `localhost` is accepted | `origin()` in `src/astro/public-site.js` refuses `127.0.0.1` and `*.localhost`; Kntnt/konzilo#94 |
| A component that draws its items from its tree loses nested components and the lightbox | Tabs, accordions, cards and a choice's answers hold only text, lists and pictures without their lightbox; Konzilo Design's checks refuse a form, a post list or a site's own component in them (Kntnt/konzilo-design#16 waits on this), and a section takes its body from its slot meanwhile; Kntnt/konzilo#55 |
| A visitor's choice about consent is not kept on the server | The public pages send a record of each choice to `/_konzilo/consent`; the service handles only forms and answers 404. ADR 0044 says such records are kept for 13 months, and the cookie declaration shows a consent ID that nobody can look up; Kntnt/konzilo#90 |
| Reports of breaches of the security policy are not kept | Pages report to `/_konzilo/violations`; no handler exists. ADR 0044 says 30 days; Kntnt/konzilo#91 |
| The log of addresses that were not found is not built | ADR 0040; the web server writes no log at all; Kntnt/konzilo#92 |
| A table cell's alignment reaches the page as an inline style a design can hardly read | Konzilo writes `style="text-align: …"`, which its policy allows only by hash (ADR 0051); the design reads `data-kn-align`, which nothing writes; Kntnt/konzilo#76 |
