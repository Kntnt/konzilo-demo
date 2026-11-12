# Konzilo Demo — agent guide

## Ground rules (authoritative)

Precedence over any conflicting skill, README, or other doc unless the user overrides in the moment.

- `docs/brief.md` says what the project is for and how it runs. Read it first.
- Every file in English. Thomas is answered in Swedish.
- All content is fictional. No real company, customer or person is named as part of Ampfield Energy, and nothing is copied from a live site.
- Every picture taken from outside is recorded in `design/images/credits.json` with its source, author and licence, in the same change that adds it.
- A fault found in Konzilo (`~/Projects/konzilo`) or Konzilo Design (`~/Projects/konzilo-design`) is fixed there, under that repository's own `AGENTS.md`, never worked around here without a note of the fault.
- Docker: remove only your own containers, images and volumes, by name. Never any `docker … prune`.

## Non-obvious

- Thomas dictates: `/[ck]on[csz]ilo/i` means Konzilo.
- `design/site.design.json` is the design file, made with Konzilo Design. Change its inputs, then run `konzilo-design resolve` on it; never edit its `resolved` part.
