read when planning the build phase, or deciding where a piece of it belongs

What the design phase learned that the build phase stands on. It is the knowledge of 2026-11-12: Konzilo at 0.4.0 and one fix, Konzilo Design at 0.6.0. Check a fact here against the code before a plan depends on it.

## The end result, as settled

`docs/brief.md` holds it. In short: a public image `ghcr.io/kntnt/konzilo-demo`, started by `docker run --rm -p 8080-8083:8080-8083 ghcr.io/kntnt/konzilo-demo`, the same in every shell and with `podman` or `nerdctl`, on amd64 and arm64, which prints the site's address when it is ready. Signing in is exactly as Konzilo has it; three people exist, one in each role; buttons on the sign-in pages only fill in a chosen person's details.

## What stands between Konzilo and one container

Konzilo runs as a Docker Compose project (`compose/` in Konzilo): Forgejo with its one-off init, a web server (Caddy, with the editor built into its image), a seed, Typesense, a builder, the service in two roles (`editors`, `visitors`), a live preview, and a tool that prints an account's second-factor code. No image of it is published. To run all of it in one container, started by plain `docker run`:

- **The programs name their peers by fixed hostnames**: `forgejo:3000`, `typesense:8108`, `editors:4100`, `visitors:4200`, and the preview on `127.0.0.1:4000` (in `bin/konzilo-builder.js`, `bin/konzilo-preview.js`, `bin/konzilo-service.js`, `compose/seed/seed.js`, `src/build/web-server.js`, the Caddyfile).
- **They share fixed folders that hold different things for different services**: `/secret` (the builder, the preview, the editors' service and Typesense each expect their own contents there, some under the same file name), `/work`, and `/site`, `/control`, `/public`, `/state`.
- **A start installs packages from the network**: `compose/builder/prepare-site.sh` runs `npm install` at every start of the builder and the preview.
- **The editor's sign-in is tied to the ports of the first start**: `compose/seed/seed.js` sets the editor's OAuth redirect once and never updates it, unlike the preview's.
- **One person is seeded**, `anna`, an Admin. The roles are Forgejo teams (`admins`, `editors`, `reviewers`); who may do what is enforced when a build reads who pushed.
- **Four origins, each a port on `localhost`**: the public site, the editor, Forgejo, the live preview. The port inside must equal the port outside, since Forgejo's own address, its answers for large files and the sign-in's redirects all name it. `origin()` in `src/astro/public-site.js` accepts only `https` or the hostname `localhost`, so `127.0.0.1` and `*.localhost` are refused, and demo content is copied only for an origin on `localhost`.
- **Signing in** goes from the editor to Forgejo's own sign-in page in a popup: user name and password, then the second factor's code, then a grant that a template clicks by itself. The code comes from a key that the seed keeps in the `state` volume.

The approach the research recommended, which nothing since has contradicted: one image on the pinned Node image (`versions.env` in Konzilo pins Node, Forgejo, Caddy and Typesense by digests that cover both architectures), with the Forgejo, Caddy and Typesense programs added, a small supervisor that starts them in order, and everything that a first start does (Forgejo's setup, the seed, the first build, the search index) done when the image is built, so that a start takes seconds. The core gains what that needs as settings with today's values as defaults: its peers' addresses and its folders from the environment, a start that installs nothing when nothing is missing, several seeded people. These serve any way of hosting Konzilo, not only the demo.

Known risks: whether the Forgejo and Typesense programs run outside their own images; the time an arm64 build takes under emulation; the image's size, perhaps one to two gigabytes; that every copy of the image holds the same passwords and keys, which is acceptable only for a demo on one's own machine, and argues for publishing the ports on `127.0.0.1` alone; that Konzilo's own decisions say there is one way to run it (ADR 0002) and set its services apart from each other (ADR 0005), which a single image departs from and should record; that Konzilo's status file says a released image needs notices of what the editor's application holds.

## What Konzilo Design lacks

- **The components that render Konzilo's directives.** Konzilo expects a design package to ship its components' declarations (`componentsFrom`), its checks (`componentChecks`) and an Astro component for each directive (ADR 0060 and 0068 of the core). Konzilo Design ships the HTML contract (`docs/spec/directives.md`), the CSS and helpers. The mockup project here has renderers for every directive, in `design/mockups/src/lib/`, each taking the attributes and the content tree as the core hands them to a component; they are the nearest thing to the missing components. The Markdown syntax they read is recorded in `design/content/README.md`, since no repository defines it.
- Whatever else is in `design/gaps.md` under Konzilo Design.

## What Konzilo lacks, beyond the single container

`design/gaps.md` lists it under Konzilo. What the approved design depends on: which rows a filtered list of posts has, and a term's page telling such a list what the page settles; a search page that takes a type and a term beside the query; a link in a form's acceptance line; a description for a menu's entry; the meta line's form; a table's column alignment in a form the design can read; and the site template, which does not use the design system at all.

## What the site itself needs

- **A site repository** as Konzilo's `bin/new-site` makes one, wired to the design as `docs/spec/konzilo.md` in Konzilo Design describes, at this repository's root beside `design/`. `new-site` pins the core by a path on the machine; a public repository needs a pin that others can fetch, now that Konzilo is public.
- **Its description**: the built-in types, with addresses as the table in `design/README.md` has them; the site's own types `case-study` and `job`, with the fields that `design/content/editorial.md` proposes; the taxonomies with addresses, so that categories, topics and authors have pages; the three forms of `design/content/site.json`; the menus.
- **Its templates**: the start page, a page, an article, a case study, a vacancy, a term's page, the search page and the 404 page, each as its mockup.
- **Its content**: every file of `design/content/` as a published content file in `demo-content/` (ADR 0025 of the core), each picture as a master of the form the core's intake makes. One article is scheduled, and stays a source file with that status.
- **The sign-in pages' buttons**, which belong to the demo alone.
- **The image**, its build for two architectures, and its publication; the package on ghcr.io is private when first pushed and is made public in its settings on GitHub.
- **Trying it** as a visitor would, on both architectures and with another engine than Docker.

## What Thomas has not yet settled

`docs/agents/status.md` lists what is open with him.
