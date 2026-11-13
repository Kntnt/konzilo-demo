read first when starting or resuming work

State at 2026-11-13. Overwrite when it changes; this is not a history.

- **Phase:** the build phase is done. `docs/brief.md` says what the project is for and which decisions bind the work.
- **The image** is published as `ghcr.io/kntnt/konzilo-demo`, version 1.2.0 under the tags `1.2.0` and `latest`, for arm64 and amd64, built from `10c9064`, which is tagged `v1.2.0`; 1.0.0 and 1.1.0 stay under their own tags. The package is public, and the README's command, run with no sign-in to ghcr.io, fetched 1.2.0 and was ready in 3.6 seconds. Known: a search in the first moments after the start may say that search is not answering (`Kntnt/konzilo-demo#4`). `README.md` says how it is run and what it needs, and `docs/agents/releasing.md` how the next one is built, proved and published, and what was and was not tried.
- **Konzilo:** 0.5.0 is released, with its package attached to the release. `#55` stays open: the design system takes a section's body from its slot instead. Other open faults are #76 to #87 and #90 to #96. `main` there allows Zlib and WTFPL and holds the editor's bundle to the license list.
- **Konzilo Design:** the site uses 0.12.0. What is left is filed there as #2 to #21.
- **The site** is at the repository's root: `site-description.json` holds the content model, `src/` a route for every address of `design/README.md`'s table, `astro.config.mjs` wires the design in place, and `scripts/demo-content.mjs` makes `demo-content/` from `design/content/`, `design/images/` and `design/logo/` through the core's own intake. `npm run check` and `npm run check:seed` prove it. Both packages are pinned by tarballs in `vendor/`. `design/content/` is still the one place a text is written. The built site is the reference for the design.
- **In Claude:** the design is on a canvas, `https://claude.ai/artifact/Ck26tvWMmWM5c3j8fu1Acq`, and the design system is published as `https://claude.ai/artifact/1Wi9WBtK6o9KX2gk7Jp8TQ`. Both are private to Thomas. They show the design at Konzilo Design 0.6.1 and are not kept up.
- **Keys for pictures:** Thomas's keys for the official interfaces of Unsplash and Pixabay are in `~/.config/kntnt/image-apis.env`, as `UNSPLASH_ACCESS_KEY` and `PIXABAY_API_KEY`. Read them inside a command and never print them or the file.
- **Docker:** nothing of this project is left in Docker.
- **The design:** the demo shows Konzilo and Konzilo Design where they are (`docs/brief.md`). Customers filters its case studies by solution, a taxonomy of the site's own with no pages. Home's "Two ways to pay" stays a table. Logistics and Retail set the customer quotation beside their teaser. Manufacturing keeps it in its own band: two cards are too narrow beside it. What else the two offer and no page shows is `Kntnt/konzilo-demo#3`.
- **Under way:** nothing.
- **Next:** what may follow is `Kntnt/konzilo-demo#3` and `#4`, and the tickets in Konzilo and Konzilo Design.
