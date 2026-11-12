#!/usr/bin/env node
// Simulates what Compose's seed does with demo-content/, and takes the result through the core's intake again,
// since that is what the editor will hold: the seed turns the published demo content back into source files
// with the core's demoSource() (compose/seed/seed.js in the core) and commits them to the source repository,
// whose every build runs the intake on them. It stops at any refusal or warning, at any post that is not live,
// and at any content file that comes out otherwise than demo-content/ holds it, but for the names of the
// masters: the seed takes each master as an original, which the intake encodes again under a name of its own.
//
//   npm run check:seed
//
// It makes demo-content/ first where anything it is made from has changed (scripts/demo-content.mjs).

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { filesIn } from './lib/files.mjs';
import { coreModule, countsOf, ROOT, runIntake, shortfalls } from './lib/intake.mjs';

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
const files = demoSource(site, DEMO);
for (const { path, content: contents } of files) {
  mkdirSync(dirname(join(source, path)), { recursive: true });
  writeFileSync(join(source, path), contents);
}

const started = Date.now();
const report = runIntake({ source, content });
const seconds = ((Date.now() - started) / 1000).toFixed(1);
const problems = shortfalls(report);
if (problems.length > 0) fail(`the intake did not take the seeded content as it is (kept in ${WORK}):\n  ${problems.join('\n  ')}`);

// Every content file as demo-content/ holds it, a master's hash aside; and as many masters.
const masked = (text) => text.replace(/-[0-9a-f]{10}\.(webp|svg)/g, '-<hash>.$1');
const texts = (folder) => new Map(filesIn(folder).filter((path) => !path.startsWith('media/') && path !== '.post-ids.json').map((path) => [path, masked(readFileSync(join(folder, path), 'utf8'))]));
const [before, after] = [texts(DEMO), texts(content)];
const differ = [...new Set([...before.keys(), ...after.keys()])].sort().filter((path) => before.get(path) !== after.get(path));
const masters = (folder) => filesIn(folder).filter((path) => path.startsWith('media/'));
const [mastersBefore, mastersAfter] = [masters(DEMO), masters(content)];
if (differ.length > 0) fail(`these content files come back otherwise than demo-content/ holds them (kept in ${WORK}):\n  ${differ.map((path) => `${path}${!before.has(path) ? ', only after' : !after.has(path) ? ', only before' : ''}`).join('\n  ')}`);
if (mastersAfter.length !== mastersBefore.length) fail(`${mastersBefore.length} masters went in and ${mastersAfter.length} came back`);
const sameNames = mastersAfter.filter((path) => mastersBefore.includes(path)).length;

rmSync(WORK, { recursive: true, force: true });
console.log(`check:seed: ${files.length} source files seeded from demo-content/; the intake made ${report.posts.length} posts live (${countsOf(report)}) in ${seconds} s, with 0 refusals and 0 warnings`);
console.log(`check:seed: all ${before.size} content files come back as demo-content/ holds them, but for the masters' names; ${mastersAfter.length} masters, ${sameNames} under the same name`);
