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
- No real person stands for an invented one: a picture in which a face can be recognised is generated, and `design/images/credits.json` says so.

## References

- `docs/agents/status.md` — read first when starting or resuming work
- `docs/agents/orchestration.md` — read when planning work, briefing a subagent, or judging what one delivered
- `docs/agents/releasing.md` — read when taking up a release of Konzilo or Konzilo Design, or building and publishing the image
- `design/README.md` — read when a page, a text, a picture or the design file is touched
- `design/gaps.md` — read when a page wants what the design system or the core cannot give, or when choosing what to put right in them
