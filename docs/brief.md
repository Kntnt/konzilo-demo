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

## How the work is done

One session plans both phases and orchestrates. It delegates the execution to subagents on Opus or Sonnet, at an effort it chooses, up to and including extra high and never max. It watches the results and raises the model or the effort when a choice proved too weak.

Thomas is away for hours at a time. Questions for him are collected and put together at few occasions. A problem the session cannot solve is brought to him.
