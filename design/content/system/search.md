# The search page

Not a post: the core builds the search page at `/search/` itself, and writes its words from its catalogue (`site.search.*` in `src/catalogues/en.json`). These are Ampfield's words for each, in the core's keys, for the build to give where the core takes a site's own texts. Where a text is the core's own and reads well, it is kept and marked so.

## The words

| Key | Text |
| --- | --- |
| `site.search.title` | Search |
| `site.search.label` | Search the site |
| `site.search.submit` | Search |
| `site.search.result` | 1 result for “{query}” |
| `site.search.results` | {count} results for “{query}” |
| `site.search.page` | , page {page} of {pages} |
| `site.search.pages` | Pages of results |
| `site.search.previous` | Previous |
| `site.search.next` | Next |
| `site.search.nothingFound` | Nothing on the site matches your search. Try a shorter or more general word, such as “solar” or “battery”, or ask us. |
| `site.search.notAnswering` | Search is not answering just now. Try again in a minute, or find your way from the menu. |
| `site.search.needsJavaScript` | Search needs JavaScript, which your browser does not run. Find your way from the menu, or write to hello@ampfield.example. |
| `site.search.notInPreview` | Search is not in the preview. (The core's own text.) |

The header's search box: the field's label is *Search the site*, and its empty field shows the word *Search*, as `site.json` gives them under `header.search`.

## An example query

**Query:** `battery`

**What it should find**, the pages whose text holds the word most, roughly in this order:

1. *A battery that takes the top off your peaks*, the Battery storage page, `/solutions/battery-storage/`, where the word is in the title, the headings and most paragraphs.
2. *Questions and answers*, `/faq/`, with three questions on batteries.
3. *Lower energy costs for factories that run all day*, the Manufacturing page, `/industries/manufacturing/`, with Kessel Packaging's words on its 5 MWh battery.
4. *Solar, storage, charging, and the software that runs them*, the Solutions page, `/solutions/`.
5. The case study of Brantevik Foods, whose two sites have a 4 MWh battery, and every article in the topic Storage.
6. *Every vehicle full by morning, on the connection you have*, the Fleet charging page, where a battery covers trucks' noon charging.

The result line reads: *{count} results for “battery”*, with *, page 1 of 2* since nineteen published posts hold the word and the core shows ten a page. Each result shows what the core's search shows: the post's title, an article's main headline in its place, its type and its date, and a snippet of eight words on each side of the first match in its text, the matched word marked.

**A query that finds nothing:** `hydrogen` finds no page, and the page shows the text of `site.search.nothingFound` above.
