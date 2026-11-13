#!/usr/bin/env node
// Simulates what Compose's seed does with demo-content/, and takes the result through the core's intake again,
// since that is what the editor will hold: the seed turns the published demo content back into source files
// with the core's demoSource() (compose/seed/seed.js in the core) and commits them to the source repository,
// whose every build runs the intake on them. It stops at any refusal or warning, at any post that is not live but a
// scheduled one, and at any content file that comes out otherwise than demo-content/ holds it, but for the hash in each
// master's name: the seed takes each master as an original, which the intake encodes again under a hash of its own. A
// post of demo-content/ dated after the moment of seeding must come out of the seed scheduled for its date, and wait
// for it in the intake, with no file and no master of its own yet.
//
//   npm run check:seed
//
// It makes demo-content/ first where anything it is made from has changed (scripts/demo-content.mjs).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { filesIn } from './lib/files.mjs';
import { coreModule, countsOf, DEMO_MOMENT, ROOT, runIntake, shortfalls } from './lib/intake.mjs';

const DEMO = join(ROOT, 'demo-content');
const WORK = join(ROOT, 'node_modules/.cache/konzilo-demo/seed');

const fail = (message) => {
  console.error(`check:seed: ${message}`);
  process.exit(1);
};

const made = spawnSync(process.execPath, ['scripts/demo-content.mjs'], { cwd: ROOT, encoding: 'utf8' });
if (made.status !== 0) fail(`scripts/demo-content.mjs failed:\n${made.stdout}${made.stderr}`);
if (!existsSync(DEMO)) fail(`there is no demo-content/ to seed from:\n${made.stdout}`);

// The seed's source files, as compose/seed/seed.js writes them to the source repository, with the site
// description read as the seed reads it.
const { readSiteDescriptionWithoutTakenComponents } = await coreModule('src/site-description.js');
const { demoSource } = await coreModule('src/demo-source.js');
const site = readSiteDescriptionWithoutTakenComponents(join(ROOT, 'site-description.json'));
const source = join(WORK, 'source');
const content = join(WORK, 'content');
rmSync(WORK, { recursive: true, force: true });
const files = demoSource(site, DEMO, { now: new Date(DEMO_MOMENT) });
for (const { path, content: contents } of files) {
  mkdirSync(dirname(join(source, path)), { recursive: true });
  writeFileSync(join(source, path), contents);
}

// Each post of demo-content/ dated after the moment of seeding, by its content file, and its source file, which the
// seed must make scheduled for that date.
const dateOf = (text) => /^date: (\S+)$/m.exec(text)?.[1];
const ahead = filesIn(DEMO).filter((path) => path.endsWith('.md') && new Date(dateOf(readFileSync(join(DEMO, path), 'utf8')) ?? 0) > new Date(DEMO_MOMENT));
const seededAhead = files.filter(({ path, content: contents }) => path.endsWith('.md') && typeof contents === 'string' && new Date(dateOf(contents) ?? 0) > new Date(DEMO_MOMENT));
const notScheduled = seededAhead.filter(({ content: contents }) => !/^status: "?scheduled"?$/m.test(contents));
if (seededAhead.length !== ahead.length) fail(`demo-content/ holds ${ahead.length} posts dated after ${DEMO_MOMENT}, and the seed made ${seededAhead.length} source files dated so`);
if (notScheduled.length > 0) fail(`the seed did not make these posts scheduled: ${notScheduled.map(({ path }) => path).join(', ')}`);

const started = Date.now();
const report = runIntake({ source, content });
const seconds = ((Date.now() - started) / 1000).toFixed(1);
const problems = shortfalls(report, new Map(), { waiting: seededAhead.map(({ path, content: contents }) => ({ file: path, at: dateOf(contents) })) });
if (problems.length > 0) fail(`the intake did not take the seeded content as it is (kept in ${WORK}):\n  ${problems.join('\n  ')}`);

// Every content file as demo-content/ holds it, a master's hash aside; and as many masters.
const masked = (text) => text.replace(/-[0-9a-f]{10}\.(webp|svg)/g, '-<hash>.$1');
const texts = (folder) => new Map(filesIn(folder).filter((path) => !path.startsWith('media/') && path !== '.post-ids.json').map((path) => [path, masked(readFileSync(join(folder, path), 'utf8'))]));
const [before, after] = [texts(DEMO), texts(content)];
// A scheduled post's file, and the masters it alone names, stay out until its moment.
const waiting = new Set(ahead);
const theirMasters = new Set(ahead.flatMap((path) => [...readFileSync(join(DEMO, path), 'utf8').matchAll(/media\/([^)\s"'\\]+)/g)].map(([, name]) => `media/${name}`)));
const early = ahead.filter((path) => after.has(path));
if (early.length > 0) fail(`the intake wrote these scheduled posts' files before their moments: ${early.join(', ')}`);
const differ = [...new Set([...before.keys(), ...after.keys()])].sort().filter((path) => !waiting.has(path) && before.get(path) !== after.get(path));
const masters = (folder) => filesIn(folder).filter((path) => path.startsWith('media/'));
const [mastersBefore, mastersAfter] = [masters(DEMO).filter((path) => !theirMasters.has(path)), masters(content)];
if (differ.length > 0) fail(`these content files come back otherwise than demo-content/ holds them (kept in ${WORK}):\n  ${differ.map((path) => `${path}${!before.has(path) ? ', only after' : !after.has(path) ? ', only before' : ''}`).join('\n  ')}`);
if (mastersAfter.length !== mastersBefore.length) fail(`${mastersBefore.length} masters of live posts went in and ${mastersAfter.length} came back`);
const sameNames = mastersAfter.filter((path) => mastersBefore.includes(path)).length;

rmSync(WORK, { recursive: true, force: true });
const live = report.posts.filter((post) => post.state === 'live').length;
console.log(`check:seed: ${files.length} source files seeded from demo-content/; the intake made ${live} posts live (${countsOf(report)})${ahead.length > 0 ? ` and kept ${ahead.length} scheduled (${seededAhead.map(({ content: contents }) => dateOf(contents)).join(', ')})` : ''} in ${seconds} s, with 0 refusals and 0 warnings`);
console.log(`check:seed: all ${before.size - ahead.length} content files of live posts come back as demo-content/ holds them, but for the hashes in the masters' names; ${mastersAfter.length} masters, ${sameNames} under the same name; ${ahead.length > 0 ? `${ahead.join(', ')} waits for its moment, with ${theirMasters.size} master${theirMasters.size === 1 ? '' : 's'} of its own` : 'no post waits'}`);
