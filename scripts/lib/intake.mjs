// The core's own intake command, run on a folder of source files as the site's build runs it, and what it
// reports, held to the demo's standard: no refusal, no warning, every post live.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// The moment the demo's content is made at: the day the design was approved. The intake runs at it (see
// fixed-clock.mjs), and it is the date of every post that has none of its own.
export const DEMO_MOMENT = '2026-11-12T12:00:00Z';

const CORE = join(ROOT, 'node_modules/@kntnt/konzilo');
const FIXED_CLOCK = fileURLToPath(new URL('./fixed-clock.mjs', import.meta.url));

// A module of the core's that its package does not export, by its path in the installed package.
export const coreModule = (path) => import(pathToFileURL(join(CORE, path)).href);

const intakeCommand = () => join(CORE, JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8')).bin['konzilo-intake']);

// Runs `konzilo-intake <source> --no-roles --site <site> --content <content>` at `moment`, and gives what it
// prints: { refusals, warnings, posts, written, removed, next }. Throws when the command fails or stops.
export function runIntake({ source, content, site = ROOT, moment = DEMO_MOMENT }) {
  const env = { ...process.env, KONZILO_DEMO_MOMENT: moment };
  // A link to the editors' host is a refusal only where one is named; a local copy names none.
  delete env.KONZILO_ADMIN_ORIGIN;
  const run = spawnSync(process.execPath, ['--import', pathToFileURL(FIXED_CLOCK).href, intakeCommand(), source, '--no-roles', '--site', site, '--content', content], { env, encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`konzilo-intake exited with ${run.status}${run.status === 3 ? ', stopped by its guard' : ''}:\n${run.stderr || run.stdout}`);
  return JSON.parse(run.stdout);
}

// Everything in an intake's report that falls short of the demo's standard, as lines to print: each refusal,
// each warning, and each post that is not live. `names`, by a source file's path, the file it was made from.
export function shortfalls(report, names = new Map()) {
  const file = (path) => (names.has(path) ? `${names.get(path)} (${path})` : path);
  return [
    ...report.refusals.map((item) => `refused: ${file(item.file)}: ${item.message}`),
    ...report.warnings.map((item) => `warning: ${file(item.file)}: ${item.message}`),
    ...report.posts.filter((post) => post.state !== 'live').map((post) => `not live: ${file(post.file)}, "${post.title}", is ${post.state}${post.at ? ` until ${post.at}` : ''}`),
  ];
}

// How many posts of each type an intake made live, as `12 articles, 3 jobs`.
export function countsOf(report) {
  const counts = new Map();
  for (const post of report.posts) if (post.state === 'live') counts.set(post.type, (counts.get(post.type) ?? 0) + 1);
  return [...counts].map(([type, count]) => `${count} ${type}`).join(', ');
}
