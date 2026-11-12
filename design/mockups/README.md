# The mockups

Every designed page of the Ampfield site as static HTML, made from Konzilo Design's released package (`../../vendor/kntnt-konzilo-design-0.3.0.tgz`), the design file `../site.design.json`, its fonts and logos, and the text in `../content/`. A built page stands alone: plain HTML with its CSS inline and relative addresses, so it opens from the file system and can be screenshotted.

The mockups are a means and will be thrown away. What they must get right is that a page shows only what the design system and Konzilo can render, placed as an editor could place it (`../README.md`, Rules for every page).

## How it works

- **A page is drawn from Konzilo Markdown.** `src/lib/markdown.js` reads Markdown as the Konzilo core does (Sätteri, GFM, directives), into the core's hast tree, with each directive as the core's plain rendering. `src/lib/render.js` draws each directive with the HTML of Konzilo Design's `docs/spec/directives.md`, using the package's own helpers (`sectionParts`, `markerAttributes`, `surfaceOf` and the rest). The package's CSS does the rest.
- **The frame** is the package's Page, Header and Footer, wired from `../content/site.json` as Konzilo Design's `docs/spec/konzilo.md` shows a Konzilo site doing it (`src/layouts/Site.astro`, `src/lib/site.js`). A canvas has no header or footer (`src/layouts/Canvas.astro`).
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
npm run shoot -- home --widths 1024,768  # other widths; --dist and --out read and write elsewhere
```

A build of a few pages takes a few seconds. Build before you shoot: the shot is of what is in `dist/`.

## Page names

A content file's page is named by its address: `/` is `home`, `/solutions/rooftop-solar/` is `solutions-rooftop-solar`, `/insights/can-your-roof-carry-solar-panels/` is `insights-can-your-roof-carry-solar-panels`, `/go/site-assessment/` is `go-site-assessment`. A file with no `address` in its frontmatter takes its type's: articles `/insights/{slug}/`, case studies `/customers/{slug}/`, jobs `/about/careers/{slug}/`, canvases `/go/{slug}/`. `system/not-found.md` is `not-found`. A misspelt name makes the build list every name there is.

How a content page is drawn, by its type:

| Type | Drawn as |
|---|---|
| `page` | The site's frame and the body's bands. A body with no `:::hero` gets the title as an H1, with its trail, in a section's head before the rest (the mockups' reading of the page template; directives.md does not say). |
| `canvas` | The body's bands, with no header or footer. |
| `article` | By its fields (directives.md, An article): the opening, the body with the following menu "In this article", and Read more (`src/lib/article.js`). |
| `case-study`, `job` | As a page, until a page file gives them a template of their own. |

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
- `src/lib/article.js` gives `opening(post, ctx)`, `body(post, ctx)` and `readMore(post, ctx)` as HTML, for any type with an article's fields (`image`, `eyebrow`, `headline`, `subheadline`, `standfirst`, `date`, `authors`, `category`).
- Write Markdown in a template literal; `String.raw` keeps a backslash, as `pages/catalogue.astro` does with `const md = String.raw`.
- The core writes some things no directive gives: the search page, the cookie declaration, the pager and a page's term list. Their markup is in Konzilo Design's `test/fixtures/konzilo-page.html`; write it into the page as HTML, and `konzilo.css` draws it.

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
| `::post-list{type presentation number include exclude where order direction offset}` | Teaser cards from `../content/`: `cards`, `featured` or `filtered`. |
| `::form{name}` | The core's form, from `site.json`'s `forms`. |

A container's fence is one colon longer than the longest inside it: `::::section` around `:::cards`, `:::::section` around `::::cards` that holds a `:::list`. A fence too short ends the outer container early and leaves `:::` standing as text on the page.

## Pictures

- In Markdown, as the text writes them: `![Alt text](image:hero-home)` for `../images/hero-home.jpg`, and `![Name](logo:norrvik-logistics)` for a file in `../logo/` or `../logo/customers/`.
- In a page file: `<Picture id="hero-home" alt="…" width="card" />`, or `picture('hero-home', 'hero')` from `src/lib/pictures.js` wherever an address is wanted.
- The width follows the place: `behind` 2400, `hero` 1600, `section` and `figure` 1400, `tab` 1000, `card` 900, `portrait` 640 pixels, or a number. The build makes `dist/images/<id>-<width>.jpg` from the original once, as a JPEG, and remakes it when the original changes.
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
                          the frame's content (site.js), content, pictures, paths
src/layouts/              Site.astro and Canvas.astro
src/components/           Post, Markdown, Picture, and the catalogue's Note
src/routes/content.astro  the one route every content page is built by
scripts/                  build.mjs and shoot.mjs
public/logos/             the design's logos, written by konzilo-design logos (not committed)
dist/<name>.html          a built page
dist/_astro/              fonts and the header's polyfills, by content hash
dist/images/              pictures by id and width, and placeholders
dist/logo/                logos from ../logo/
dist/logos/               the design's own logos
shots/                    screenshots: <name>-<width>[-dark][-menu|-search].png
```

## What a page shows that the site would not

- Every picture is a JPEG at one width, with no `srcset`; the core makes WebP masters and several widths.
- A figure keeps the core's button that opens the lightbox, but not the lightbox's dialog.
- The consent controls' buttons show, as they do once the core's script has run; the consent banner does not.
- A code block has no Shiki colours.
- The header's script that chooses how the bar gives way runs, as on the site. Nothing else needs a script, except the two catalogue frames that open the menu and the search box.
