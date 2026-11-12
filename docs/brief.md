# The brief

Thomas Barregren's brief for this project, given on 2026-11-12, in English. It is the authority on what the project is for. Change it only when he changes the brief.

## Goal

A demonstration website built entirely on [Konzilo](https://github.com/Kntnt/konzilo). It has everything one expects of a normal website for a fictional B2B company. The content looks real: English text, and pictures from Unsplash or a similar source.

## Purpose

To show what a site built on Konzilo looks like on the public side and in the administrator's interface, and to let administrators and editors explore that interface.

## End result

A public container image, and one command that the user pastes into a shell, after which the whole demo site is fetched and started on their own computer.

- The command works on Linux, Mac and Windows, on Intel/AMD and ARM processors.
- All the user needs is an installed and running container engine that runs OCI images, such as Docker Desktop, Docker Engine, OrbStack, Colima, Rancher Desktop or Podman.
- The command is the same in bash, zsh, PowerShell and cmd. Only its first word may differ: `docker`, `podman` or `nerdctl`. An example, in which the image's name and the port are not settled: `docker run --rm -p 8080:80 ghcr.io/kntnt/konzilo-demo`.
- No login, configuration or further installation is needed.
- When the site is ready, its address is printed in the terminal.

## Design

The site uses a design system made with [Konzilo Design](https://github.com/Kntnt/konzilo-design). Its defaults are sound, so little should need changing, and its default header and footer content is a sensible starting point.

## What the work finds on the way

The work will find problems, shortcomings and bugs in Konzilo and Konzilo Design, and possibly better solutions.

- Problems, shortcomings and bugs are fixed, tested, committed and pushed.
- A possibly better solution to something that already works well is not built now. It gets a pull request with a feature request ticket.

## Two phases

1. **Design.** Plan the phase, create the repository locally and on GitHub, and prepare. Make the design system, and design every page with Claude Design. Present the design to Thomas.
2. **Build.** When Thomas has approved the design: plan the phase and prepare, build the whole solution, and publish the image as `ghcr.io/kntnt/konzilo-demo`.

## What Thomas settled on 2026-11-12

When the design was presented, and in the hours after, he settled these.

- **The name** Ampfield Energy stays, though a company called Ampfield Aktiebolag exists in Stockholm, in another business.
- **Pictures of people** are made by an image model, through Codex, from the stock photograph that was chosen: much the same picture, with an invented person's face. No real person stands for an invented one.
- **Other pictures** are searched for anew with his keys to the picture services. Where no free photograph shows what a page wants, the picture is generated in the same way, and its credit says so. He is shown the changes afterwards, on a contact sheet.
- **Signing in to the editor** is exactly as Konzilo has it, second factor and all. The demo has three people, one in each role: Admin, Editor and Reviewer. Buttons on the sign-in pages may fill in a chosen person's details with a script, and do nothing more; the visitor signs in with the form itself.
- **The command** publishes four fixed ports, one for each of Konzilo's origins, to the user's own computer alone: `docker run --rm -p 127.0.0.1:8080-8083:8080-8083 ghcr.io/kntnt/konzilo-demo`. Every copy of the image holds the same passwords, and the sign-in pages show them, so the demo is not opened to the network the computer is on.
- **Releases** of Konzilo and Konzilo Design may be made when the demo needs them and their own gates pass.
- **A possibly better solution** gets an issue as its feature request, and a pull request with code only where the change is small.
- **Statistics and video:** one article embeds a video, so that the consent placeholder shows. The site counts no visits, and its policies say nothing of Matomo.
- **The repository** is public, under the AGPL as Konzilo is. Its history was made anew without the stock photographs of real people before it was published.
- **The Malmö office's telephone number**, +46 40 628 04 00, stays, though only a secondary source says that its series is set aside for fiction.
- **The page's shadow on the footer** comes and goes at once, as the header's does, so that the footer needs no script.
- **The design** is approved. `design/feedback.md` holds what he asked for on the way, point by point.

## What Thomas settled on 2026-11-13

When the build phase's plan was put to him.

- **The pictures** that were compromises, all generated anew, are approved as the contact sheet showed them.
- **The start page** is a page an Admin chooses, as the page for addresses not found is chosen, so that an editor can open Home. Konzilo gains this (`Kntnt/konzilo#67`); it is the page composition that his decision of 2026-10-27 waited for.
- **The dates:** the scheduled article and the vacancies' last days move a year on, so that the demo shows a scheduled post and open vacancies for a year, and starts without building.
- **Picture credits** stay in the repository. The site gets no page of them.
- **The source of the image's GPL and LGPL parts** is pointed to where their makers publish it. No copy is kept beside a release.
- **Konzilo's site template** stays plain. Konzilo Design may later gain its own way to turn a new site into a designed one.
- **Consent records and reports of breaches of the security policy** (Konzilo's ADR 0044) are built after the demo, as a spec of their own.
- **A section's head** always stands at the start edge, never centred. **An opening without a picture** keeps its height, two thirds of the window's.

## How the work is done

One session plans both phases and orchestrates. It delegates the execution to subagents on Opus or Sonnet, at an effort it chooses, up to and including extra high and never max. It watches the results and raises the model or the effort when a choice proved too weak.

Thomas is away for hours at a time. Questions for him are collected and put together at few occasions. A problem the session cannot solve is brought to him.
