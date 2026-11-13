#!/usr/bin/env node
// The image's one program, under tini: it starts Konzilo's programs in order (programs.mjs), prints a few plain
// lines and then, when the site is ready, its four addresses and how to sign in, and stops everything at Ctrl-C
// (SIGINT) or SIGTERM. When a program stops by itself, it says which, shows its last lines and stops with
// status 1. Each program's whole output is in /tmp/konzilo-logs/<name>.log, which `docker exec` reads.

import { existsSync, mkdirSync, readFileSync } from 'node:fs';

import { environmentOf, PEOPLE, PORTS, PROGRAMS, START } from './programs.mjs';
import { supervise } from './supervise.mjs';
import { bannerLines, plain, readyLines, startingLine } from './terminal.mjs';

const started = Date.now();
const say = (line) => process.stdout.write(`${plain(line)}\n`);
const RELEASE = new URL('./release.json', import.meta.url).pathname;
const release = existsSync(RELEASE) ? JSON.parse(readFileSync(RELEASE, 'utf8')) : {};

for (const line of bannerLines(release)) say(line);
// Forgejo's temporary folder, which it does not make itself.
mkdirSync('/tmp/gitea', { recursive: true });

const status = await supervise({
  programs: PROGRAMS,
  order: START,
  logs: '/tmp/konzilo-logs',
  say,
  environmentOf: (program) => environmentOf(program),
  onStarting: (names) => say(startingLine(names.map((name) => PROGRAMS[name].label))),
  onReady: () => {
    for (const line of readyLines({ seconds: (Date.now() - started) / 1000, ports: PORTS, people: PEOPLE, release })) say(line);
  },
});
say(status === 0 ? 'Stopped.' : 'Stopped. Konzilo Demo could not run; the lines above say why.');
process.exit(status);
