#!/usr/bin/env node
// Checks the site as it stands, in three steps, and stops at the first that fails:
//
//   1. the site description passes the core's own checker;
//   2. scripts/demo-content.mjs makes the demo content with no refusal and no warning, and makes the same bytes
//      when it is run again;
//   3. `npm run build` builds every address of the table in design/README.md, "The site", each post and term
//      of design/content/ in the place of its {slug}, but what the demo content leaves out (LEFT_OUT in
//      scripts/demo-content.mjs).
//
//   npm run check
//
// It removes content/ where it is a copy of the demo content, as scripts/demo-content.mjs does, and stops where
// content/ is the site's own, which the build would be made from.

import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { digestOf } from './lib/files.mjs';
import { coreModule, DEMO_MOMENT, ROOT } from './lib/intake.mjs';

const DEMO = join(ROOT, 'demo-content');
const DIST = join(ROOT, 'dist');
const DESIGN_CONTENT = join(ROOT, 'design/content');

const fail = (message) => {
  console.error(`check: ${message}`);
  process.exit(1);
};

// A command run to its end, its output printed as it was and given back.
function run(command, args) {
  const result = spawnSync(command, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1024 * 1024 * 256 });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error || result.status !== 0) fail(`${command} ${args.join(' ')} failed:\n${output}${result.error ?? ''}`);
  return output;
}

// 1. The core's checker.
const { readSiteDescription } = await coreModule('src/site-description.js');
let site;
try {
  site = readSiteDescription(join(ROOT, 'site-description.json'));
} catch (error) {
  fail(`the core's checker refuses site-description.json:\n${error.message}`);
}
console.log(`check: site-description.json passes the core's checker: ${Object.keys(site.types).length} types (${Object.keys(site.types).join(', ')}), ${Object.keys(site.taxonomies).length} taxonomies, ${Object.keys(site.components).length} components, ${Object.keys(site.presentations).length} presentations, ${Object.keys(site.forms).length} forms, ${Object.keys(site.menus).length} menus, ${site.settings.length} settings of its own`);

// 2. The demo content, made twice.
const once = run(process.execPath, ['scripts/demo-content.mjs', '--force']);
if (!/0 refusals, 0 warnings/.test(once)) fail(`scripts/demo-content.mjs made no demo content:\n${once}`);
const first = digestOf(DEMO);
run(process.execPath, ['scripts/demo-content.mjs', '--force']);
if (digestOf(DEMO) !== first) fail('scripts/demo-content.mjs made other bytes the second time');
console.log(`check: ${once.trim().split('\n').map((line) => line.replace(/^demo-content: /, '')).join('\n       ')}`);
console.log(`check: a second run made the same bytes, ${first.slice(0, 16)}…`);

// 3. The build, and every address of the table.
const built = run('npm', ['run', 'build']);
const pages = /(\d+) page\(s\) built/.exec(built)?.[1] ?? fail(`the build did not say how many pages it built:\n${built}`);
const warnings = built.split('\n').filter((line) => /\[WARN\]|\bwarn(ing)?\b/i.test(line) && !/0 warnings/.test(line));
console.log(`check: npm run build built ${pages} pages${warnings.length > 0 ? `, and warned:\n  ${warnings.join('\n  ')}` : ', with no warning'}`);

// The posts and terms of design/content/ by their folders, each slug once; a post dated after the content's
// moment is the scheduled one, which the demo content leaves out.
const frontmatterDate = (path) => /^date: (\S+)$/m.exec(readFileSync(path, 'utf8'))?.[1];
const slugsIn = (folder) => readdirSync(join(DESIGN_CONTENT, folder)).filter((name) => /\.(md|json)$/.test(name)).map((name) => {
  const slug = name.replace(/\.(md|json)$/, '');
  const date = name.endsWith('.md') ? frontmatterDate(join(DESIGN_CONTENT, folder, name)) : undefined;
  return { slug, scheduled: date !== undefined && new Date(date) > new Date(DEMO_MOMENT) };
});
const general = (address) => address.replace('{path}', '{slug}');
const folderOf = (address) => {
  const type = Object.values(site.types).find((one) => one.address && general(one.address) === address);
  if (type) return type.collection;
  const taxonomy = Object.values(site.taxonomies).find((one) => one.address && general(one.address) === address);
  return taxonomy?.collection ?? fail(`design/README.md has the address ${address}, which no type or taxonomy of site-description.json has`);
};

const readme = readFileSync(join(ROOT, 'design/README.md'), 'utf8');
const table = readme.slice(readme.indexOf('## The site'), readme.indexOf('### The menu'));
const rows = table.split('\n').filter((line) => /^\| (`\/|any other)/.test(line)).map((line) => line.split('|')[1].trim().replace(/`/g, ''));
const results = [];
const page = (address) => (address === 'any other' ? join(DIST, '404.html') : join(DIST, address, 'index.html'));
const isBuilt = (file) => existsSync(file) && readFileSync(file, 'utf8').includes('<main>');
for (const row of rows) {
  if (!row.includes('{slug}')) {
    results.push({ address: row, built: isBuilt(page(row)) });
    continue;
  }
  for (const { slug, scheduled } of slugsIn(folderOf(row))) {
    const address = row.replace('{slug}', slug);
    results.push({ address, built: isBuilt(page(address)), leftOut: scheduled ? 'scheduled, LEFT_OUT.scheduled' : null });
  }
}
// What the table names in its words, and the Home page's stand-in.
results.push({ address: '/insights/feed/ (the article feed)', built: existsSync(join(DIST, 'insights/feed/index.rss')) });
const home = readFileSync(join(DESIGN_CONTENT, 'pages/index.md'), 'utf8');
const homeTitle = JSON.parse(/^title: (.+)$/m.exec(home)[1]);
results.push({ address: '/ shows the Home page (LEFT_OUT.home)', built: readFileSync(page('/'), 'utf8').includes(homeTitle) });

for (const { address, built: done, leftOut } of results) console.log(`  ${done ? 'built     ' : leftOut ? 'left out  ' : 'NOT BUILT '} ${address}${leftOut && !done ? ` (${leftOut})` : ''}`);
const missing = results.filter((one) => !one.built && !one.leftOut);
const surplus = results.filter((one) => one.built && one.leftOut);
if (surplus.length > 0) fail(`built though the demo content leaves it out: ${surplus.map((one) => one.address).join(', ')}`);
if (missing.length > 0) fail(`not built: ${missing.map((one) => one.address).join(', ')}`);
console.log(`check: every address of design/README.md's table is built, ${results.filter((one) => one.built).length} pages and checks, ${results.filter((one) => one.leftOut).length} left out on purpose`);
