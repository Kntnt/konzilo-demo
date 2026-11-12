# The mockups

Every designed page of the Ampfield site as static HTML, made from Konzilo Design's released package (`../../vendor/kntnt-konzilo-design-0.6.1.tgz`), the design file `../site.design.json`, its fonts and logos, and the text in `../content/`. A built page stands alone: plain HTML with its CSS inline and relative addresses, so it opens from the file system and can be screenshotted.

The mockups are a means and will be thrown away. What they must get right is that a page shows only what the design system and Konzilo can render, placed as an editor could place it (`../README.md`, Rules for every page).

## How it works

- **A page is drawn from Konzilo Markdown.** `src/lib/markdown.js` reads Markdown as the Konzilo core does (Sätteri, GFM, directives), into the core's hast tree, with each directive as the core's plain rendering. `src/lib/render.js` draws each directive with the HTML of Konzilo Design's `docs/spec/directives.md`, using the package's own helpers (`sectionParts`, `markerAttributes`, `surfaceOf` and the rest). The package's CSS does the rest.
- **The frame** is the package's Page, Header and Footer, wired from `../content/site.json` as Konzilo Design's `docs/spec/konzilo.md` shows a Konzilo site doing it (`src/layouts/Site.astro`, `src/lib/site.js`). A footer cell's text in `site.json` may write a link as Markdown, `[Konzilo](https://www.konzilo.com/)`, which is drawn as a link, since a cell's content is the site's own HTML. A canvas has no header or footer (`src/layouts/Canvas.astro`).
- **Every content file is a page already.** A file in `../content/` with frontmatter is built by the name of its address. A page file in `pages/` of the same name takes its place.

## Commands

From this folder (`npm install` has been run; run it again only after `package.json` changes):

```sh
npm run build -- home solutions          # builds dist/home.html and dist/solutions.html
npm run build -- catalogue --out /tmp/x  # builds into another folder
npm run build -- --all                   # every page (only when no one else is editing)
npm run shoot -- home                    # shots/home-1440.png and shots/home-390.png, full page, light
npm run shoot -- home --dark             # also shots/home-1440-dark.png and shots/home-390-dark.png
npm run shoot -- home --state menu       # the header's menu open, the window only: shots/home-1440-menu.png …
npm run shoot -- home --state search     # the search box open, likewise
npm run shoot -- home --state scrolled   # scrolled down and a little back up, the header over the content
npm run shoot -- home --state end        # scrolled down to the very end, the footer revealed: shots/home-1440-end.png …
npm run shoot -- home --state ending     # half the footer's height short of the end, the page leaving the footer
npm run shoot -- home --widths 1024,768  # other widths; --dist and --out read and write elsewhere
```

A build of a few pages takes a few seconds. Build before you shoot: the shot is of what is in `dist/`.

The footer lies at the window's edge, and a full-page capture keeps the window's height, so it would paint the footer at the window's bottom, under the page. `shoot` takes a full page's last rows, as tall as the footer, from the window scrolled to the end, where the footer stands as a visitor sees it.

## Page names

A content file's page is named by its address: `/` is `home`, `/solutions/rooftop-solar/` is `solutions-rooftop-solar`, `/insights/can-your-roof-carry-solar-panels/` is `insights-can-your-roof-carry-solar-panels`, `/go/site-assessment/` is `go-site-assessment`. A file with no `address` in its frontmatter takes its type's: articles `/insights/{slug}/`, case studies `/customers/{slug}/`, jobs `/about/careers/{slug}/`, canvases `/go/{slug}/`. `system/not-found.md` is `not-found`. A misspelt name makes the build list every name there is.

How a content page is drawn, by its type:

| Type | Drawn as |
|---|---|
| `page` | The site's frame and the body's bands. A body with no `:::hero` gets the title as an H1, with its trail, in a section's head before the rest (the mockups' reading of the page template; directives.md does not say). |
| `canvas` | The body's bands, with no header or footer. |
| `article` | By its fields (directives.md, An article): the opening, the body with the following menu "In this article", and Read more (`src/lib/article.js`). |
| `case-study` | By its fields, made like an article (`src/lib/types.js`): the opening with the main image and the customer as its eyebrow, the body with the project's facts in its Aside, More case studies, and a band that leads on to a site assessment. |
| `job` | By its fields (`src/lib/types.js`): an opening on tint with the title, the excerpt, the fields as a value list and "How to apply", the body with its following menu "On this page", and the other vacancies as rows. |

Pages that are no content file, each a page file of its own: the term pages `insights-category-guides` and `insights-author-priya-raman` (`src/lib/terms.js`, `termPage(collection, slug)`, which draws any category, topic or author), and the search page `search` (`src/lib/search.js`). See The editorial templates, below.

Pages that are not the site's: `index` (this folder's index, `dist/index.html`) and `catalogue` with its three header frames.

## Adding a page

A page file is `pages/<name>.astro`. Use it for what a content file cannot give: a type's own template (case study, job), a term page (category, topic, author), the search page, or a page the text does not hold yet.

The same layout as a content page, with a template of your own around its body:

```astro
---
import Site from '../src/layouts/Site.astro';
import Markdown from '../src/components/Markdown.astro';
import { postByFile } from '../src/lib/content.js';
import { opening } from '../src/lib/article.js';
import { context } from '../src/lib/render.js';
import { design } from '../src/lib/design.js';
import { trailFor } from '../src/lib/site.js';

const post = postByFile('case-studies/norrvik-logistics.md');
const ctx = context({ design, title: post.data.title, address: post.address, trail: trailFor(post.address, post.data.title), post });
---
<Site title={post.data.title} address={post.address}>
  <Fragment set:html={opening(post, ctx)} />
  <Markdown address={post.address} source={`::::section

## The project in figures

:::list{type="values"}

- Solar
  - ${post.data.solarCapacity} MWp
- Charge points
  - ${post.data.chargePoints}

:::

::::`} />
  <Markdown file={post.file} address={post.address} />
</Site>
```

- `<Site title address>` is the frame; `address` marks the menu's current entry. `<Canvas title>` has none.
- `<Markdown source={…}>` draws Konzilo Markdown; `<Markdown file="…">` draws a content file's body. `title` is the page's title: a hero holds it as its H1, and a body with no hero gets it, with the trail, in a section of its own first; leave it out where the page writes its title itself, as above. `address` (and `trail`, `[{ label, href }, …, { label }]`) give the trail that `::breadcrumbs` draws, which `trailFor(address, label)` makes from the levels above. With `body`, the blocks stand as inside a section's body, for a band you write yourself. Ids stay unique across the `<Markdown>` blocks of a page.
- `<Post file="…">` is the whole page a content file makes, as the build makes it.
- `src/lib/article.js` gives `opening(post, ctx, { label, after, surface })`, `body(post, ctx, { aside, menu, label })` and `readMore(post, ctx, { heading, more, surface, chosen })` as HTML, for any type with an article's fields (`image`, `eyebrow`, `headline`, `subheadline`, `standfirst`, `date`, `authors`, `category`, `topics`). The case study and the vacancy are made of them.
- Write Markdown in a template literal; `String.raw` keeps a backslash, as `pages/catalogue.astro` does with `const md = String.raw`.
- The core writes some things no directive gives: the search page, the cookie declaration, the pager and a page's term list. Their markup is in Konzilo Design's `test/fixtures/konzilo-page.html`; write it into the page as HTML, and `konzilo.css` draws it.

## The editorial templates

The article, the case study, the vacancy, the term page and the search page, as `src/lib/article.js`, `types.js`, `terms.js` and `search.js` draw them, and the post lists of `posts.js`. Each is made of the design's parts only; where a page wanted more, the nearest part stands in, as said below.

- **One composition for every text page.** The opening is a Hero, its picture the main image (behind the text, as the design has it); a post without one, the vacancy, has its Hero on `tint`. The body is a band holding a Reading Area, the Aside at the start before the flow (`data-kn-side="start"`, `data-kn-stack="before"`), so on a phone the Aside comes first: an article's following menu "In this article", a vacancy's "On this page", a case study's facts. What follows the body stands on `raised`, so it does not join the body's band; a band that leads on to an action stands last on `tint`, never on `brand`, since the footer's first band is `brand`.
- **The article** (directives.md, An article). The meta line is the core's sentence by the article type's format, `By {authors} • Published {date} in {category}` (`META_LINE_FORMAT` in `src/lib/article.js`, Thomas's words), the authors and the category linked to their pages, then the topics as pills, each linked to its topic's page: "By Priya Raman • Published 13 October 2026 in Guides • SOLAR". Read more is up to three related articles, ranked as the core ranks them (ADR 0070), on `raised`.
- **The case study.** The customer is the eyebrow; there is no meta line, since the core gives a type of the site's own none unless an Admin sets a format. The type's fields stand in the Aside as an Aside Block on `raised` holding a Value List: customer, industry (linked to its industry page), location, what was built, the capacities it has, how it was paid for and the day in service. Then More case studies, the related ones filled up to three, and the band "Find out what your site can do", the template's own words.
- **The vacancy.** The opening holds the title, the excerpt as the deck, the four fields as a Value List (two by two beside the reading measure) and one main action, "How to apply", to the body's crosshead of that name. Then the body, and Other vacancies on `raised`, as rows.
- **Term pages** (`termPage('categories', 'guides')`, `'authors'`, `'topics'`). No Hero: at the design's two-thirds of the window a name and a sentence would stand at the bottom of an empty band. The opening is a section's head on `tint`: the trail, the eyebrow (Category, Topic or Author), the term's name as the H1 and its description as the deck. Then its posts of every type that takes the taxonomy (a topic's case studies too), newest first, nine a page, three rows of three as on Insights (the core's `termPages()` takes the number; its default is ten), as the `filtered` presentation with the rows Category, Topics and Search less the row the page settles (a category's page has no Category row, a topic's page no Topic row, an author's page all three), the core's pager where they fill more than a page, and the newsletter band Insights ends with. An author's portrait cannot be shown: a term holds a name and a description.
- **The search page.** The title band (trail and H1), then the core's `.konzilo-search` as its script leaves it, in the reading column: the form with the query, the status, ten results a page and the link to the next. Each result is what the core's search shows, a post's title (an article's headline), its type, its date and eight words on each side of the first match, marked; the order is system/search.md's for its example query, then the core's weights.
- **Post lists** follow the core's evaluator: no post dated after today (the scheduled article), and a post shown by a list above is left out of the lists below it (`leaveOutShown`), so Insights' Earlier articles leave out the three Latest. `pages="true"` shows the first `number` posts and the core's pager (`.konzilo-pager`). A teaser's text is the core's `ownSummary()`: the excerpt, else the teaser's text, else the standfirst; a case study's label is its customer. `where` takes a field's value with spaces, `where="industry=Logistics and warehousing"`, as the core's does.
- **`filtered`** (directives.md, `presentation="filtered"`) has the rows `filters` names, `category`, `topics` and `search`, in that fixed order, and one row of topics where it names none: each a row of pills of the terms of the list's posts on every page, the most posts first, then the search row, whose form goes to `/search/` with the list's type, and on a term's page its term, as hidden fields. The count says "Showing 9 of 17 articles" where the list has pages. `filters` is the attribute directives.md proposes; the core has none yet.
- **`rows`** is a presentation of the site's own, Konzilo Design's Content Loop as rows without pictures, for vacancies: office and team above the title, employment and last day to apply below, the excerpt under them.

## Placing each renderer

`dist/catalogue.html` shows every renderer once, with a note on the Markdown that gives it, and `pages/catalogue.astro` holds that Markdown. In short:

| Markdown | Draws |
|---|---|
| `::::hero` … `::::` | The page's opening: `::breadcrumbs` first, a picture before the text as a logo, `::eyebrow[…]`, the deck as the first paragraph, `:::list{type="actions"}`, `::small[…]`, the hero's picture last. The heading is the post's title. `surface`: page, raised (default), inverse, tint, brand, accent. |
| `:::section{surface anchor}` | A band. Pictures first (the first the section's picture, the others badges), eyebrows, `##`, the deck, actions; then the body. Its layout follows the six rules of directives.md. Loose blocks at the top level stand in a section of their own. |
| `:::aside{anchor}` | A fact box: `::eyebrow[…]`, a heading, text and lists. |
| `:::list{markers}` | A Markdown list with signs (`v`, `x`) or numberings (`1.`, `a)`, `(i)`, `1/1.1`, …) per level. |
| `:::list{type="description"}`, `"values"`, `"logos"`, `"actions"` | Terms and descriptions, labels and values, a band of logos, actions. Each item's sub-items are its descriptions or its value; the intro is the label. The main action is `- **[Label](/address/)**`. |
| `:::cards` | A series. Items begin at their headings; a card's picture and eyebrow are written after its heading and drawn first. A heading that is a link, and the card's only link, makes the card a link as a whole. `markers="1"` draws steps; `markers="v"` without pictures draws reasons; `type="navigation"`, `picture="behind"`, `symbol="item"` and `symbol="heading"` as directives.md says. |
| `:::accordion{first expand}` | Items at headings; all questions draws questions and answers. |
| `:::tabs`, `:::choice`, `:::toc` | Items at headings; the intro is the label, the question, the menu's label. Headings under a tab or an answer are written a level lower and raised. |
| `::eyebrow[…]`, `::small[…]`, `::breadcrumbs` | The text roles, wherever they stand. |
| `::post-list{type presentation number include exclude where order direction offset pages empty}` | The published posts of `../content/` (none dated after today), as the core evaluates a list: a post shown by a list above on the page is left out of the lists below it. `cards`, `featured` and `filtered` are the design's teaser cards. `rows` is the site's own presentation, Konzilo Design's Content Loop as rows without pictures, for vacancies above all: each vacancy's office and team, its title as the link, its employment and last day to apply, and its excerpt. `pages="true"` shows the first `number` posts and the core's pager. |
| `::form{name}` | The core's form, from `site.json`'s `forms`. A checkbox's label may write a link as Markdown, `[privacy policy](/privacy-policy/)`, which is drawn as a link; the core cannot yet. |

A container's fence is one colon longer than the longest inside it: `::::section` around `:::cards`, `:::::section` around `::::cards` that holds a `:::list`. A fence too short ends the outer container early and leaves `:::` standing as text on the page.

## Pictures

- In Markdown, as the text writes them: `![Alt text](image:hero-home)` for `../images/hero-home.jpg`, and `![Name](logo:norrvik-logistics)` for a file in `../logo/` or `../logo/customers/`.
- In a page file: `<Picture id="hero-home" alt="…" width="card" />`, or `picture('hero-home', 'hero')` from `src/lib/pictures.js` wherever an address is wanted.
- The width follows the place: `behind` 2400, `hero` 1600, `section` and `figure` 1400, `tab` 1000, `card` 900, `portrait` 640 pixels, or a number. The build makes `dist/images/<id>-<width>.jpg` from the original once, as a JPEG, and remakes it when the original changes.
- A drawing, such as a card's symbol or a badge, is `../images/<id>.svg`, written `image:<id>` like a photograph and copied as it is to `dist/images/<id>.svg` at every width.
- A picture that has not arrived shows a grey placeholder with its id, `dist/images/missing-<id>.svg`, and the build does not fail. Build the page again once the picture is there.

## Working beside other agents

- **Build only your own pages**, by name. Each run builds in a folder of its own under `.build/` and then copies its pages into `dist/`; files there are named by their content (`_astro/`) or by picture and width (`images/`), so two runs never write one file differently. Two agents can build at once.
- For a folder of your own, add `--out <folder>` to the build and `--dist <folder> --out <folder>` to the shot.
- A page file of yours that does not build stops `--all` for everyone: keep `--all` for when no one is editing.
- **Shared, and changed only with need and the orchestrator's knowledge:** `astro.config.mjs`, `package.json`, `scripts/`, `src/lib/`, `src/layouts/`, `src/components/`, `src/mockup.css`, `pages/catalogue*.astro`. A renderer that draws something otherwise than directives.md says is a fault to report, not to work around in a page. Something a page wants that the design cannot render goes into `../gaps.md`.
- `src/fallback.design.json` is Konzilo Design's example design, used only while `../site.design.json` is missing.

## On disk

```text
pages/                    page files, one per page that is not a plain content file
src/lib/                  the reader (markdown.js), the renderers (render.js, article.js, posts.js, forms.js),
                          the templates (types.js, terms.js, search.js), the frame's content (site.js), content,
                          pictures, paths
src/layouts/              Site.astro and Canvas.astro
src/components/           Post, Markdown, Picture, and the catalogue's Note
src/routes/content.astro  the one route every content page is built by
scripts/                  build.mjs and shoot.mjs
public/logos/             the design's logos, written by konzilo-design logos (not committed)
dist/<name>.html          a built page
dist/_astro/              fonts and the polyfills the header and footer load, by content hash
dist/images/              pictures by id and width, and placeholders
dist/logo/                logos from ../logo/
dist/logos/               the design's own logos
shots/                    screenshots: <name>-<width>[-dark][-menu|-search|-scrolled|-end|-ending].png
```

## What a page shows that the site would not

- Every picture is a JPEG at one width, with no `srcset`; the core makes WebP masters and several widths.
- A figure keeps the core's button that opens the lightbox, but not the lightbox's dialog.
- The consent controls' buttons show, as they do once the core's script has run; the consent banner does not.
- A paragraph of a YouTube address alone is the core's embed as its consent placeholder, the question, the sentence and *Allow and play* in the core's words (`src/lib/embeds.js`); the button loads nothing. Another service's address stays a paragraph.
- A code block has no Shiki colours.
- The header's script that chooses how the bar gives way runs, as on the site, and so does the footer's that says whether it fits in the window. Nothing else needs a script, except the two catalogue frames that open the menu and the search box.
- The header slides away and comes back in Chromium and, by its polyfill, in Firefox, opened from the file system. WebKit refuses a module's import on a page opened from the file system, so there the header stays; served over HTTP it slides away as elsewhere. The build writes the polyfills' addresses in a script as `./_astro/…`, since a bare `_astro/…` is no module specifier.
- The footer's reveal works in Chromium, Firefox and WebKit, from the file system and over HTTP: the build writes the footer's script, `footer-fit.js`, which imports nothing, into the page.
- A search from a filtered list goes to `/search/`, which the mockups do not answer.

## The design canvas in Claude

`scripts/to-canvas.mjs` carries the designed pages onto the design canvas "Ampfield Energy website" in Claude: a page of live artboards, each a built page's own markup with its stylesheet, and a page of the same pages as screenshots. `scripts/to-canvas.json` records the canvas's address, the design system it holds and every upload. Build every page and shoot the shots the boards name (`ROWS` in the script, the header's three states included: `--state menu`, `search` and `scrolled`), and work in a folder outside the repository:

```sh
node scripts/to-canvas.mjs --out <folder>                          # lists the files to upload, or writes <folder>/project/
node scripts/to-canvas.mjs record --out <folder> <file> <url> …    # records each upload's /_blob/ address
node scripts/to-canvas.mjs check --out <folder>                    # the artboard format's rules; the conversion runs it too
node scripts/to-canvas.mjs preview --out <folder> --ds <ds> [<board> …]  # each artboard drawn locally, compared with shots/
node scripts/to-canvas.mjs unused --out <folder> <url> …           # of the canvas's uploads, those no artboard names
node scripts/to-canvas.mjs forget --out <folder> <url> …           # takes removed uploads out of the record
```

- Upload the listed files to the canvas with the Artifact tool (`publish` with `asset: true`, up to 25 a call), and record what each upload returns. The record keeps a hash of each file, so a later run asks only for files that changed.
- When nothing is left to upload, the run writes the canvas's files. Before publishing, read the canvas's `project/canvas.json` and run again with `--index <file>`, so that what others added is kept. Publish from `<folder>` as the root, in one call: `project/canvas.json`, the artboards that changed, and the design system's `files` entries the run prints. The canvas refuses to replace the system's copied files until this session has seen them: list the canvas's files (`scope: "files"`) first.
- The design system "Ampfield Energy" is `designSystem` in the record: its address, the version copied, and the files the canvas holds under `project/ds/ampfield/`. With `use` true, as now, the artboards load its `components/bundle.css`, which brings the fonts, and `canvas-patch.css`; `styles/kn.css` and the font files are then neither uploaded nor linked. For a new version of the system, set `version` and `copiedAt` and publish its files again. `preview` needs the system's files read into a folder with the Artifact tool, named by `--ds`; `--with ds` draws artboards that load `kn.css` with the system's stylesheet instead, to compare the two.
- To take away uploads nothing uses any more, list the canvas's assets (`scope: "assets"`), give their addresses to `unused`, delete those it names, and `forget` them.
- `--dry` makes up the addresses, to try a change with `preview` before uploading anything. Never publish a dry run.
- `--shots <folder>` reads the shots from elsewhere than `shots/`, as `npm run shoot -- … --out <folder>` writes them.
- A page taller than a frame may be (8,000 px) goes on in a second live frame beside the first, "…, continued", the rest of the page to its end, so that its footer shows. Home and the article at 390 px have one.
- `approved` in the record is the day Thomas approved the design. With it, the canvas's note says so, and names the Konzilo Design the mockups are built with.
- What an artboard needs beyond its page is told above `patchCss()` and in `liveBoard()`: a frame as tall as the page, the menu or search box shown open without a modal dialog, and the header over the content as a scroll leaves it, the page drawn as far up as the shot scrolled it.
