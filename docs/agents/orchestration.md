read when planning work, briefing a subagent, or judging what one delivered

How the design phase was run, and what it taught. The brief (`docs/brief.md`) sets the role: one session plans and orchestrates, and subagents on Opus or Sonnet do the work, at an effort up to and including extra high, never max.

## What worked

- **Two research briefs before any plan.** One agent read Konzilo, one read Konzilo Design, each with a list of questions and a report by those headings. The plan was made from their reports, and the largest facts of the project (the design system shipped no components for Konzilo's directives; nothing could run in one container) came from them.
- **Opus at extra high effort** for work that is not specified in detail: the mockup project's foundation, composing pages, every change to Konzilo Design with its release, the canvas, a fault in Konzilo that had to be found before it could be fixed. Each such agent delivered, with an honest account of what it had not verified.
- **Opus at high effort** for bounded work that needs an eye: finishing passes, taking up a release, fetching pictures.
- **Sonnet at high effort** for a procedure written out step by step: a two-file change with a gate to run, an audit with web searches. Its one slip was a long command put in the background in a way that returned at once; say how a long command is waited for.
- **One writer of commits.** Agents never commit or push in this repository; the orchestrator looks at what they made, commits and pushes. In Konzilo and Konzilo Design the agent that makes a change commits and pushes it, under that repository's own rules.
- **Named ownership of files** whenever two agents work at the same time, and a rule for the few shared files: read again immediately before changing, change only what is small and local, name it in the report.
- **Looking.** An agent that changes how a page looks must screenshot it and look at the screenshot with the Read tool. A full-page screenshot is too tall to be seen whole and must be cut into parts of about 2,000 px. The orchestrator looked at overviews and close-ups before presenting anything.
- **Going back to the same agent** for a follow-up in the area it knows (the canvas, the design system in Claude) saved it from learning the area again. A fresh agent was better for a new round in Konzilo Design, where the repository's own documents carry what the agent needs.
- **A brief says what is wanted and why,** names the files to read rather than retelling them, sets the boundaries (what is read-only, who commits, where scratch files go), and says what the report must hold. It does not say how.
- **Faults go where they belong.** A fault in Konzilo or Konzilo Design is fixed there, with a test, and released when its own gate passes; the demo then takes the release up. Three releases of Konzilo Design were made this way in one day.

## What to know

- **Konzilo's gate** (`npm run gate`) takes half an hour on a quiet machine and over an hour on a busy one, and uses Docker and three browser engines. One at a time.
- **Konzilo Design's tests** (`npm test`) take about two minutes and need Playwright's browsers, which are installed.
- **A canvas or a design system in Claude cannot be opened from a session,** and their types' instructions say not to try. What is published there is checked by drawing the same content locally and comparing it with a screenshot. Only Thomas sees the real thing.
- **Pictures** are fetched through the official interfaces of Unsplash and Pexels, with keys that Thomas provides. In the design phase they were fetched by getting past the services' checks for automated clients; that is not done again. `docs/agents/status.md` says whether the keys exist.
- **Pictures of people** are generated through Codex (the `agents:codex` skill), from the photograph chosen for composition and light. Each generated picture says so in `design/images/credits.json`.
- **Invented names, streets and numbers** are checked against the world before they are published. A street that exists, a telephone number outside a series reserved for fiction, or a prominent person's name is a fault.
- **The shell refuses `rm` on a path held in a variable.** Name each path to delete in full.
- **Thomas is asked few questions at a time,** each with its context, the choices and a recommendation first, as an editor, an administrator or an owner would meet the matter. He answers in Swedish and may dictate: "Consilo", "Koncilo" and the like mean Konzilo.
