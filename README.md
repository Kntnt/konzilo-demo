# Konzilo Demo

A demonstration website built on [Konzilo](https://github.com/Kntnt/konzilo), for the fictional company Ampfield Energy. It shows what a Konzilo site looks like to its visitors and to its editors, and lets anyone explore the editor on their own computer.

Ampfield Energy does not exist. Its people, customers, figures and addresses are invented.

Konzilo is a core for websites whose editors write Markdown, in an editor in the browser, and whose visitors get a static site built by Astro. The demo runs all of it on your own computer, with one command: the public site, the editor, a live preview of what is saved but not yet published, and Forgejo, where the site's content is kept and where its people sign in. Sign in, change something, save it, and see it on the public site within a minute.

## Run it

With a container engine running (see [What it needs](#what-it-needs)), paste this into a terminal:

```
docker run --rm -p 127.0.0.1:8080-8083:8080-8083 ghcr.io/kntnt/konzilo-demo
```

With Podman or nerdctl, the first word is `podman` or `nerdctl`; the rest is the same. The first time, the image is downloaded, about 540 MB. A few seconds after it starts, it prints these four addresses:

| Address | What is there |
|---|---|
| http://localhost:8080 | Ampfield Energy's website, as its visitors see it |
| http://localhost:8081 | The editor, where the site's people write, schedule and publish |
| http://localhost:8083 | The live preview: the site with everything that is saved, published or not |
| http://localhost:8082 | Forgejo, where you sign in; the editor and the live preview take you there |

The site has three people, one in each of Konzilo's roles: Ada Lindholm, the Admin, who may also change the site's settings, menus and legal pages; Edvin Hale, the Editor; and Rosa Quinlan, the Reviewer, who reads the live preview and changes nothing. To sign in, open the editor and choose to sign in with Forgejo. Forgejo's sign-in page shows each person's user name and password, with a button for each that fills in the form, and the next page has a button that fills in the person's code from their authenticator. You send each form yourself. The Reviewer signs in at the live preview, since the editor is not for Reviewers.

Press Ctrl+C in the terminal to stop it. Nothing is kept: whatever you changed is gone when it stops, and the next start begins where the image began.

The command downloads the image only the first time, and after that starts the copy you have. Its first line says the version and the day the image was built. To get the newest, run `docker pull ghcr.io/kntnt/konzilo-demo` first.

## What it needs

- **A container engine** that runs Linux containers, running. The demo was tried with Docker Desktop on a Mac with Apple silicon, for both architectures, the one for Intel and AMD processors emulated, and with rootless Podman and with nerdctl, each run inside a Linux container on that Mac. It was not tried on Windows, nor with Docker Engine on Linux, OrbStack, Colima or Rancher Desktop.
- **Memory:** about 0.4 GB once it has started, and about 2.7 GB while the live preview is open and a save is being built. Give the engine 4 GB. Held to 2 GB, the demo starts and runs, but a save built while the live preview was open has needed more: the preview was stopped for lack of memory, and the demo with it.
- **An architecture** it is built for: `linux/arm64`, such as Apple silicon, or `linux/amd64`, such as Intel and AMD processors. The engine fetches the one that fits.
- **The ports 8080 to 8083** on your own computer. The command publishes them on `127.0.0.1` alone, so that nothing else on your network reaches the demo, whose passwords everyone knows.

## When the ports are taken

The demo needs the ports 8080 to 8083 on your computer, with the same numbers inside the container, since the sign-in and the editor name them. If another program, or another copy of the demo, uses one of them, the command stops at once with a message such as `port is already allocated` or `address already in use`. Find what holds the port, and stop it:

- **macOS and Linux:** `lsof -nP -iTCP:8080-8083 -sTCP:LISTEN` names the program. If it names Docker (`com.docker` on a Mac), a container holds the port.
- **Windows, in PowerShell:** `Get-NetTCPConnection -LocalPort 8080,8081,8082,8083 -State Listen` gives the program's process ID, and `Get-Process -Id <the ID>` its name.
- **A container:** `docker ps --filter publish=8080` names it, and `docker stop <name>` stops it. A copy of the demo stops with Ctrl+C in its own terminal.

On Windows, the system may reserve a range of ports that holds them. `netsh int ipv4 show excludedportrange protocol=tcp` lists the ranges; stopping and starting the service that reserves them, with `net stop winnat` and `net start winnat` in a terminal run as administrator, usually frees them.

## What the image holds

The image holds the site and its demo content, [Konzilo](https://github.com/Kntnt/konzilo) and its editor, Forgejo, Caddy and Typesense, on Node.js and Debian, each under its own licence. In the image, `/usr/share/doc/konzilo-demo/NOTICES.md` names every part, its version, its licence and where its maker publishes its source at that version, with the licence texts beside it; Typesense's program is stripped of its debugging symbols, as the notices say. To read them:

```
docker run --rm --entrypoint cat ghcr.io/kntnt/konzilo-demo /usr/share/doc/konzilo-demo/NOTICES.md
```

The image is built from this repository, by `npm run image:build`, from the [`Dockerfile`](Dockerfile) and [`image/`](image/). [`docs/brief.md`](docs/brief.md) says what the project is for.

## License

Copyright (C) 2026 Kntnt Sweden AB

Konzilo Demo is free software: you can redistribute it and/or modify it under the terms of the GNU Affero General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.

Konzilo Demo is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU Affero General Public License for more details.

[`LICENSE`](LICENSE) holds the license's text. Its identifier is `AGPL-3.0-or-later`, the same as Konzilo's.

The photographs, typefaces and icons are the work of others and keep their own licences. [`design/images/credits.json`](design/images/credits.json) names each picture's source and licence, and the typefaces' licences are beside them in [`design/fonts/`](design/fonts/).
