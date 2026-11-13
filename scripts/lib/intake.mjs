// The core's own intake command, run on a folder of source files as the site's build runs it, and what it
// reports, held to the demo's standard: no refusal, no warning, every post live.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

// The moment the demo's content is made at: the day the design was approved. The intake runs at it (its option
// `--now`), so that it writes the same bytes on any day, and it is the date of every post that has none of its own.
export const DEMO_MOMENT = '2026-11-12T12:00:00Z';

const CORE = join(ROOT, 'node_modules/@kntnt/konzilo');

// A module of the core's that its package does not export, by its path in the installed package.
export const coreModule = (path) => import(pathToFileURL(join(CORE, path)).href);

const intakeCommand = () => join(CORE, JSON.parse(readFileSync(join(CORE, 'package.json'), 'utf8')).bin['konzilo-intake']);

// Runs `konzilo-intake <source> --no-roles --site <site> --content <content> --now <moment>`, and gives what it
// prints: { refusals, warnings, posts, written, removed, next }. Throws when the command fails or stops.
export function runIntake({ source, content, site = ROOT, moment = DEMO_MOMENT }) {
  const env = { ...process.env };
  // A link to the editors' host is a refusal only where one is named; a local copy names none.
  delete env.KONZILO_ADMIN_ORIGIN;
  const run = spawnSync(process.execPath, [intakeCommand(), source, '--no-roles', '--site', site, '--content', content, '--now', moment], { env, encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });
  if (run.error) throw run.error;
  if (run.status !== 0) throw new Error(`konzilo-intake exited with ${run.status}${run.status === 3 ? ', stopped by its guard' : ''}:\n${run.stderr || run.stdout}`);
  return JSON.parse(run.stdout);
}

// Everything in an intake's report that falls short of the demo's standard, as lines to print: each refusal,
// each warning, and each post that is not live. `names`, by a source file's path, the file it was made from.
// `waiting`, the source files of the posts expected to wait for their moments, each { file, at }; `passed`, those of
// the scheduled posts whose moments are expected to have passed, each with the core's one warning that says so.
export function shortfalls(report, names = new Map(), { waiting = [], passed = [] } = {}) {
  const file = (path) => (names.has(path) ? `${names.get(path)} (${path})` : path);
  const waits = (post) => post.state === 'waiting' && waiting.some((one) => one.file === post.file && new Date(one.at).valueOf() === new Date(post.at).valueOf());
  const expected = (item) => passed.includes(item.file) && scheduledPassed().test(item.message);
  return [
    ...report.refusals.map((item) => `refused: ${file(item.file)}: ${item.message}`),
    ...report.warnings.filter((item) => !expected(item)).map((item) => `warning: ${file(item.file)}: ${item.message}`),
    ...passed.filter((path) => !report.warnings.some((item) => item.file === path && expected(item))).map((path) => `no warning: ${file(path)} is scheduled for a moment that had passed, which the intake did not say`),
    ...report.posts.filter((post) => post.state !== 'live' && !waits(post)).map((post) => `not live: ${file(post.file)}, "${post.title}", is ${post.state}${post.at ? ` until ${post.at}` : ''}`),
    ...waiting.filter((one) => !report.posts.some((post) => post.file === one.file && waits(post))).map((one) => `not waiting: ${file(one.file)} is not scheduled for ${one.at}`),
  ];
}

// The core's warning that a scheduled post's moment had passed when the site first read it, as a pattern of its words
// in the site's language, English (the core's src/catalogues/en.json, warning.scheduled-passed), any moment in it, as
// the reason the report's message ends with, after the post and its field.
function scheduledPassed() {
  const words = JSON.parse(readFileSync(join(CORE, 'src/catalogues/en.json'), 'utf8'))['warning.scheduled-passed'];
  if (typeof words !== 'string') throw new Error('the core has no warning.scheduled-passed, the warning a scheduled post whose moment had passed gives');
  return new RegExp(`(^|: )${words.split('{moment}').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.+')}$`);
}

// How many posts of each type an intake made live, as `12 articles, 3 jobs`.
export function countsOf(report) {
  const counts = new Map();
  for (const post of report.posts) if (post.state === 'live') counts.set(post.type, (counts.get(post.type) ?? 0) + 1);
  return [...counts].map(([type, count]) => `${count} ${type}`).join(', ');
}
