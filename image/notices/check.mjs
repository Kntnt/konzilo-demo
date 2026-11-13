#!/usr/bin/env node
// In the image: every part it holds is named in its notices, /usr/share/doc/konzilo-demo/. It looks at what the
// image holds, not at what the notices say: every program in /usr/local/bin and every folder in /opt, every
// Debian package dpkg has installed, every npm package in every tree of node_modules, every Go module the image's
// Caddy is built from, and the folders of the image's own software; that each part under the GPL, the LGPL or the
// AGPL, and each library or package such a part bundles, names where its maker publishes its source at the version
// the image holds; and that each license text a part names is there. It prints what it found, and exits 1 at
// anything not named.
//
//   docker run --rm --entrypoint node <image> /konzilo-demo/notices/check.mjs

import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

import { modulesOf } from './caddy-modules.mjs';
import { debianPackagesIn, npmPackagesIn, unsourced } from './walk.mjs';

const DOC = process.argv[2] ?? '/usr/share/doc/konzilo-demo';
const read = (name) => JSON.parse(readFileSync(join(DOC, name), 'utf8'));
const parts = read('parts.json');
const npm = read('npm-packages.json');
const debian = read('debian-packages.json');
const problems = [];
const found = [];

const named = (path) => parts.some((part) => part.where.some((where) => where === path || where.startsWith(`${path} `) || where.includes(path)));

// Every program in /usr/local/bin, by its path in a part.
const namedExactly = (path) => parts.some((part) => part.where.includes(path));
for (const name of readdirSync('/usr/local/bin')) {
  if (!namedExactly(`/usr/local/bin/${name}`)) problems.push(`/usr/local/bin/${name} is in no part the notices name`);
}
found.push(`${readdirSync('/usr/local/bin').length} programs in /usr/local/bin`);
for (const name of readdirSync('/opt')) {
  const covered = parts.some((part) => part.where.some((where) => where.startsWith('/opt/') && new RegExp(`^${where.replace(/[.+?^$()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test(`/opt/${name}`)));
  if (!covered) problems.push(`/opt/${name} is no part the notices name`);
}
for (const path of ['/konzilo', '/konzilo-demo', '/site', '/srv/admin', '/site/design/fonts']) {
  if (existsSync(path) && !named(path)) problems.push(`${path} is in no part the notices name`);
}

// Debian's packages.
const listed = new Map(debian.map((one) => [one.package, one.version]));
const installed = debianPackagesIn(readFileSync('/var/lib/dpkg/status', 'utf8'));
for (const one of installed) {
  if (listed.get(one.package) !== one.version) problems.push(`the Debian package ${one.package} ${one.version} is not in debian-packages.json`);
}
found.push(`${installed.length} Debian packages`);

// Every tree of npm packages.
const TREES = [['/konzilo', 'core'], ['/builder-work/site', 'site'], ['/preview-work/site', 'site'], ['/usr/local/lib', 'node']];
for (const [root, tree] of TREES) {
  const known = new Set((npm[tree]?.packages ?? []).map((one) => `${one.name}@${one.version}`));
  const here = npmPackagesIn(root);
  for (const one of here) {
    if (!known.has(`${one.name}@${one.version}`)) problems.push(`the npm package ${one.name}@${one.version} in ${root}/${one.path} is not in npm-packages.json under "${tree}"`);
  }
  found.push(`${here.length} npm packages in ${root}`);
}
// Any other tree of node_modules, outside those and the trees inside the builder's and the preview's work.
const others = [];
const look = (folder, depth) => {
  if (depth > 4 || !existsSync(folder)) return;
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (!stat.isDirectory()) continue;
    if (name === 'node_modules') {
      if (!TREES.some(([root]) => realpathSync(path) === join(root, 'node_modules'))) others.push(path);
      continue;
    }
    look(path, depth + 1);
  }
};
for (const top of ['/konzilo', '/konzilo-demo', '/site', '/srv', '/opt', '/builder-work', '/preview-work', '/usr/local/lib', '/home']) look(top, 0);
for (const path of others) problems.push(`${path} is a tree of npm packages the notices do not list`);

// The source of each part under the GPL, the LGPL or the AGPL, at the version the image holds, and of what such a
// part bundles: libvips's libraries as the image's own versions.json names them.
const bundled = {};
for (const root of ['/konzilo', '/builder-work/site']) {
  for (const one of npmPackagesIn(root).filter((candidate) => /^@img\/sharp-libvips-/.test(candidate.name))) {
    const file = join(root, one.path, 'versions.json');
    if (existsSync(file)) Object.assign(bundled, JSON.parse(readFileSync(file, 'utf8')));
  }
}
problems.push(...unsourced({ parts, debian, bundled }));
found.push(`${parts.filter((one) => one.copyleft).length} parts under a copyleft license, each with the address of its source`);

// Every Go module the image's Caddy is built from, with its licence and notice files.
const caddyListed = new Map(JSON.parse(readFileSync(join(DOC, 'licenses/caddy/modules/modules.json'), 'utf8')).map((one) => [`${one.module}@${one.version}`, one]));
const caddyModules = modulesOf(execFileSync('/usr/local/bin/caddy', ['build-info'], { encoding: 'utf8' }));
for (const { path, version } of caddyModules) {
  const listed = caddyListed.get(`${path}@${version}`);
  if (!listed) problems.push(`Caddy is built from ${path}@${version}, which the notices do not name`);
  else if (listed.texts.length === 0) problems.push(`Caddy is built from ${path}@${version}, whose licence the notices do not hold`);
  else for (const text of listed.texts) if (!existsSync(join(DOC, 'licenses/caddy/modules', `${path}@${version}`, text))) problems.push(`${path}@${version}: its ${text} is not there`);
}
found.push(`${caddyModules.length} Go modules of Caddy, each with its licence`);

// Each text a part names.
for (const part of parts) {
  for (const text of part.texts) {
    const path = text.startsWith('/') ? text : join(DOC, text);
    if (!existsSync(path)) problems.push(`${part.name}: its text ${text} is not there`);
  }
}
found.push(`${parts.length} parts, each with its texts`);

console.log(`notices: ${found.join(', ')}`);
if (problems.length > 0) {
  console.log(`notices: ${problems.length} things the notices do not name:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('notices: every part the image holds is named');
