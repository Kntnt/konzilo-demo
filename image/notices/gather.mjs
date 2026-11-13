#!/usr/bin/env node
// When the image is built, in the Dockerfile's stage `notices`: what the image owes for every part it holds,
// gathered from the parts themselves into one folder, /usr/share/doc/konzilo-demo/ in the image:
//
//   NOTICES.md            each part, its version, its license, where it is in the image, where its source is at
//                         that version, and what was done to it
//   parts.json            the same, for a program: check.mjs reads it
//   npm-packages.json     every npm package in the image, with its license and the files in its own folder that
//                         hold its license and notices
//   debian-packages.json  every Debian package, with the source package and version it was built from, and the
//                         address of that source in Debian's snapshot archive
//   licenses/             the license texts that are not in the parts' own folders in the image
//
// The source of each part is where its maker publishes it: each line names the exact version the image holds and
// the address of its source at that version, made here from what the image holds. Where a part bundles others
// (libvips, Typesense), their addresses are read from the maker's own build files at that version, fetched here;
// the build stops if they cannot be.
//
//   node gather.mjs <inputs> <folder to write>
//
// The inputs are what the Dockerfile puts in <inputs>: the core's source (konzilo/), the editor's files with
// their notices (editor/), the vendors' programs (forgejo, caddy,
// typesense-server, each the build machine's, which say the same versions as the target's), the licence files of
// the Go modules Caddy is built from (caddy-modules/, by caddy-modules.mjs), what was done to Typesense
// (typesense-strip.json), the target's dpkg status, /usr/share/doc and /opt (dpkg-status, doc/, opt/),
// Node's license (node-LICENSE), the core's and the site's installed packages (core-node-modules/,
// site-node-modules/), Node's own (node-lib-node-modules/), the site (site/) and its pictures' credits
// (credits.json). CORE_DESCRIBED in the environment says which core it is.

import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { debianLicensesIn, debianPackagesIn, npmPackagesIn } from './walk.mjs';

const [inputs, out] = process.argv.slice(2);
const COMMON = '/usr/share/common-licenses';
const at = (...path) => join(inputs, ...path);
// What this script makes for itself on the way; it runs as a user who may not write in <inputs>.
const scratch = mkdtempSync(join(tmpdir(), 'gather-'));
const licenses = join(out, 'licenses');
mkdirSync(licenses, { recursive: true });

const place = (part, name) => {
  mkdirSync(join(licenses, part), { recursive: true });
  return [join(licenses, part, name), `licenses/${part}/${name}`];
};
const copy = (from, part, name = from.split('/').at(-1)) => {
  const [to, named] = place(part, name);
  copyFileSync(from, to);
  return named;
};
const writeText = (part, name, text) => {
  const [to, named] = place(part, name);
  writeFileSync(to, text);
  return named;
};
const run = (command, ...args) => execFileSync(command, args, { encoding: 'utf8', env: { ...process.env, HOME: '/tmp' } }).trim();

// A file of a maker's, fetched, three times at most; the build stops without it.
async function fetched(url) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const answer = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!answer.ok) throw new Error(`${answer.status}`);
      return await answer.text();
    } catch (error) {
      if (attempt === 3) throw new Error(`gather: could not fetch ${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
}

// --- What the vendors' programs say of themselves.
const forgejoVersion = /forgejo version (\S+)/.exec(run(at('forgejo'), '--version'))?.[1] ?? null;
if (!forgejoVersion) throw new Error('gather: Forgejo does not say its version');
const forgejoTag = `v${forgejoVersion.split('+')[0]}`;
const caddyVersion = run(at('caddy'), 'version').split(' ')[0];
const caddyInfo = run(at('caddy'), 'build-info');
// Each Go module's licence and notice files, which the stage `caddy-modules` fetched (caddy-modules.mjs).
const caddyModules = JSON.parse(readFileSync(at('caddy-modules', 'modules.json'), 'utf8'));
const caddyModulesWithout = caddyModules.filter((one) => one.texts.length === 0);
// Typesense prints its version first, and then that it was given no data folder, with a status that says so.
const typesenseSaid = spawnSync(at('typesense-server'), ['--version'], { encoding: 'utf8' });
const typesenseVersion = /^Typesense (\d+\.\d+(?:\.\d+)?)\b/m.exec(`${typesenseSaid.stdout}${typesenseSaid.stderr}`)?.[1] ?? null;
if (!typesenseVersion) throw new Error('gather: Typesense does not say its version');
const typesenseTag = `v${typesenseVersion}`;
const strip = JSON.parse(readFileSync(at('typesense-strip.json'), 'utf8'));

// Forgejo's own list of the Go modules and JavaScript packages it is built from, with their licenses, which it
// serves at /assets/licenses.txt.
const forgejoAssets = join(scratch, 'forgejo-assets');
mkdirSync(forgejoAssets);
execFileSync(at('forgejo'), ['embedded', 'extract', '--destination', forgejoAssets, 'public/assets/licenses.txt'], { env: { ...process.env, GITEA_WORK_DIR: '/tmp/forgejo-work', HOME: '/tmp' }, stdio: 'ignore' });

// Typesense's dependencies, which it links statically: each archive and repository its WORKSPACE names at the
// version the image holds.
const workspace = await fetched(`https://raw.githubusercontent.com/typesense/typesense/${typesenseTag}/WORKSPACE`);
const typesenseDependencies = [...workspace.matchAll(/^\s*(?:http_archive|new_git_repository|git_repository)\(\s*\n([\s\S]*?)\n\s*\)/gm)].map(([, block]) => {
  const value = (key) => new RegExp(`^\\s*${key}\\s*=\\s*"([^"]*)"`, 'm').exec(block)?.[1];
  const urls = /^\s*urls\s*=\s*\[([\s\S]*?)\]/m.exec(block)?.[1];
  const remote = value('remote');
  const address = value('url') ?? (urls ? /"([^"]+)"/.exec(urls)?.[1] : null) ?? (remote ? `${remote}, at ${value('commit') ?? value('tag') ?? value('branch')}` : null);
  return { name: value('name'), version: null, address };
}).filter((one) => one.name && one.address);
if (typesenseDependencies.length < 10) throw new Error(`gather: Typesense's WORKSPACE at ${typesenseTag} names only ${typesenseDependencies.length} dependencies`);

// --- The npm packages of each tree in the image.
const tree = (folder) => {
  // npmPackagesIn reads <root>/node_modules; each input is a node_modules folder of its own name.
  const root = join(scratch, `${folder}-root`);
  mkdirSync(root, { recursive: true });
  execFileSync('ln', ['-sfn', at(folder), join(root, 'node_modules')]);
  return npmPackagesIn(root);
};
const npm = {
  core: { where: '/konzilo/node_modules', packages: tree('core-node-modules') },
  site: { where: '/builder-work/site/node_modules and /preview-work/site/node_modules', packages: tree('site-node-modules') },
  node: { where: '/usr/local/lib/node_modules, npm and corepack as Node ships them', packages: tree('node-lib-node-modules') },
};
const installed = Object.values(npm).flatMap(({ packages }) => packages);
const withoutTexts = installed.filter((one) => one.texts.length === 0);

// The editor's files bundle packages the core builds them from, whose notices the core writes beside them.
const editorNotices = readdirSync(at('editor')).find((name) => /^third-party-notices/i.test(name));
if (!editorNotices) throw new Error('gather: the editor\'s files have no third-party-notices.txt beside them');

// --- libvips with sharp: LGPL-3.0-or-later, with the libraries it bundles, whose versions its versions.json names,
// and whose sources sharp-libvips' build/posix.sh fetches at that tag.
const libvips = installed.filter((one) => /^@img\/sharp-libvips-/.test(one.name));
const libvipsVersions = [...new Set(libvips.map((one) => one.version))];
if (libvipsVersions.length !== 1) throw new Error(`gather: the image holds libvips at ${libvipsVersions.length} versions: ${libvipsVersions.join(', ')}`);
const libvipsTag = `v${libvipsVersions[0]}`;
const libvipsOwn = libvips.map((one) => join(at('site-node-modules'), one.path.replace(/^node_modules\//, ''), 'versions.json')).find(existsSync);
if (!libvipsOwn) throw new Error('gather: no libvips package holds its versions.json');
const bundled = JSON.parse(readFileSync(libvipsOwn, 'utf8'));
const posix = await fetched(`https://raw.githubusercontent.com/lovell/sharp-libvips/${libvipsTag}/build/posix.sh`);
const libvipsNotices = await fetched(`https://raw.githubusercontent.com/lovell/sharp-libvips/${libvipsTag}/THIRD-PARTY-NOTICES.md`);
const variable = (name) => `VERSION_${name.toUpperCase().replace(/-/g, '_')}`;
// A URL of build/posix.sh, with the shell's expansions of the versions done as the script does them.
const expand = (template) => template
  .replace(/\$\(without_patch \$(VERSION_\w+)\)/g, (_, name) => `\${${name}%patch}`)
  .replace(/\$\(without_prerelease \$(VERSION_\w+)\)/g, (_, name) => `\${${name}%prerelease}`)
  .replace(/\$\{(VERSION_\w+)(\/\/\.\/.|%patch|%prerelease)?\}/g, (_, name, how) => {
    const key = Object.keys(bundled).find((one) => variable(one) === name);
    if (!key) throw new Error(`gather: sharp-libvips' build/posix.sh names ${name}, which versions.json has not`);
    const version = bundled[key];
    if (!how) return version;
    if (how === '%patch') return version.split('.').slice(0, 2).join('.');
    if (how === '%prerelease') return version.replace(/-.*$/, '');
    return version.replaceAll('.', how.slice(-1));
  });
const fetches = [...posix.matchAll(/\$CURL (https:\/\/[^|\n]*?)\s*(?:\| (tar|patch)\b[^\n]*)?$/gm)].map(([, template, how]) => ({ template, how }));
const libraries = Object.entries(bundled).map(([name, version]) => {
  const own = fetches.find(({ template, how }) => how === 'tar' && new RegExp(`\\$\\{?${variable(name)}\\b`).test(template));
  return { name, version, address: own ? expand(own.template) : null };
});
const patches = fetches.filter(({ how }) => how === 'patch').map(({ template }) => template);
const unaddressed = libraries.filter((one) => !one.address);
if (unaddressed.length > 0) throw new Error(`gather: sharp-libvips' build/posix.sh at ${libvipsTag} names no source for ${unaddressed.map((one) => one.name).join(', ')}`);

// --- Debian's packages, each with the source package it was built from and its address in the snapshot archive.
const debian = debianPackagesIn(readFileSync(at('dpkg-status'), 'utf8')).map((one) => {
  const file = at('doc', one.package, 'copyright');
  return {
    ...one,
    sourceAddress: `https://snapshot.debian.org/package/${one.source}/${encodeURIComponent(one.sourceVersion)}/`,
    copyright: existsSync(file) ? `/usr/share/doc/${one.package}/copyright` : null,
    licenses: existsSync(file) ? debianLicensesIn(readFileSync(file, 'utf8')) : [],
  };
});
const debianCopyleft = debian.filter((one) => one.licenses.some((name) => /\b(L?GPL|AGPL)/.test(name)));

// --- The site's typefaces and pictures, and the core's own texts.
const fonts = readdirSync(at('site/design/fonts')).filter((name) => /^LICENSE/i.test(name)).map((name) => copy(at('site/design/fonts', name), 'fonts'));
const credits = JSON.parse(readFileSync(at('credits.json'), 'utf8'));
const pictureCount = Array.isArray(credits) ? credits.length : Object.values(credits).find(Array.isArray)?.length ?? Object.keys(credits).length;
const coreManifest = JSON.parse(readFileSync(at('konzilo/package.json'), 'utf8'));
const coreTexts = ['LICENSE', 'SITE-EXCEPTION.md', 'ACKNOWLEDGEMENTS.md', 'THIRD-PARTY.md', 'TRADEMARKS.md'].filter((name) => existsSync(at('konzilo', name))).map((name) => copy(at('konzilo', name), 'konzilo'));
const designPackage = npm.site.packages.find((one) => one.name === '@kntnt/konzilo-design');
const gpl3 = copy(join(COMMON, 'GPL-3'), 'gpl', 'GPL-3.0.txt');
const lgpl3 = copy(join(COMMON, 'LGPL-3'), 'gpl', 'LGPL-3.0.txt');
const apache = copy(join(COMMON, 'Apache-2.0'), 'caddy', 'LICENSE');
const yarn = readdirSync(at('opt')).filter((name) => /^yarn-v/.test(name));
// The Node image's own programs, as this stage, on the same image, holds them: Node's, npm's, corepack's, its
// entrypoint's, and Yarn's.
const nodeImagePrograms = readdirSync('/usr/local/bin').map((name) => `/usr/local/bin/${name}`);
const yarnPrograms = nodeImagePrograms.filter((path) => /\/yarn(pkg)?$/.test(path));
const coreDescribed = process.env.CORE_DESCRIBED || coreManifest.version;

const parts = [
  {
    name: 'Konzilo Demo',
    version: null,
    license: 'AGPL-3.0-or-later',
    copyleft: true,
    where: ['/site', '/konzilo-demo'],
    source: 'https://github.com/Kntnt/konzilo-demo, at the commit /konzilo-demo/release.json names',
    texts: [copy(at('site/LICENSE'), 'konzilo-demo')],
    note: 'This image\'s own code and the site of the fictional Ampfield Energy, whose texts and people are invented.',
  },
  {
    name: 'Konzilo',
    version: coreDescribed,
    license: 'AGPL-3.0-or-later, with Konzilo\'s site exception',
    copyleft: true,
    where: ['/konzilo', '/builder-work/site/node_modules/@kntnt/konzilo', '/preview-work/site/node_modules/@kntnt/konzilo'],
    source: /\+/.test(coreDescribed) ? `https://github.com/Kntnt/konzilo/tree/${coreDescribed.split('.').at(-1)}` : `https://github.com/Kntnt/konzilo/tree/v${coreDescribed}`,
    texts: coreTexts,
    note: 'Until the core does all the image needs, or where it has a fault, the image changes its copy of the core as each file of Konzilo Demo\'s image/stand-ins/ says, each marked in its Dockerfile.',
  },
  {
    name: 'Konzilo\'s editor',
    version: coreDescribed,
    license: 'AGPL-3.0-or-later, with the bundled packages under their own licenses',
    copyleft: true,
    where: ['/srv/admin'],
    source: `${/\+/.test(coreDescribed) ? `https://github.com/Kntnt/konzilo/tree/${coreDescribed.split('.').at(-1)}` : `https://github.com/Kntnt/konzilo/tree/v${coreDescribed}`}, whose scripts/build-editor.js builds it`,
    texts: [`/srv/admin/${editorNotices}`],
    note: `It bundles Sveltia CMS, Milkdown, ProseMirror, CodeMirror and more, whose notices the core writes beside the bundle, in /srv/admin/${editorNotices}.`,
  },
  {
    name: 'Node.js',
    version: process.version.slice(1),
    license: 'MIT, with the licenses of the parts it bundles',
    copyleft: false,
    where: [...nodeImagePrograms.filter((path) => !yarnPrograms.includes(path)), '/usr/local/lib/node_modules', '/usr/local/include/node'],
    source: `https://github.com/nodejs/node/tree/${process.version}`,
    texts: [copy(at('node-LICENSE'), 'node', 'LICENSE')],
    note: 'From the core\'s pinned image node:<version>-bookworm-slim, with npm and corepack, whose packages are in npm-packages.json under "node", and the image\'s docker-entrypoint.sh, from https://github.com/nodejs/docker-node under MIT.',
  },
  ...yarn.map((name) => ({
    name: 'Yarn',
    version: name.slice('yarn-v'.length),
    license: 'BSD-2-Clause',
    copyleft: false,
    where: [`/opt/${name}`, ...yarnPrograms],
    source: `https://github.com/yarnpkg/yarn/tree/${name.slice('yarn-'.length)}`,
    texts: existsSync(at('opt', name, 'LICENSE')) ? [copy(at('opt', name, 'LICENSE'), 'yarn', 'LICENSE')] : [],
    note: 'As the Node image ships it. Nothing in the image uses it.',
  })),
  {
    name: 'Debian GNU/Linux',
    version: '12 (bookworm)',
    license: 'Each package\'s own, in /usr/share/doc/<package>/copyright',
    copyleft: true,
    where: ['/'],
    source: 'Each package\'s source at its version in Debian\'s snapshot archive, https://snapshot.debian.org/package/<source>/<version>/, as debian-packages.json names it',
    sources: debian.map((one) => ({ name: one.package, version: one.version, address: one.sourceAddress })),
    texts: [],
    note: `${debian.length} packages, Git, Git LFS, tini and CA certificates among them. ${debianCopyleft.length} are under the GPL or the LGPL by their copyright files, among them ${debianCopyleft.filter((one) => ['git', 'bash', 'coreutils', 'tar'].includes(one.package)).map((one) => `${one.package} ${one.version}`).join(', ')}.`,
  },
  {
    name: 'Forgejo',
    version: forgejoVersion,
    license: 'GPL-3.0-or-later, with the parts from Gitea under MIT',
    copyleft: true,
    where: ['/usr/local/bin/forgejo'],
    source: `https://codeberg.org/forgejo/forgejo/releases/tag/${forgejoTag}`,
    texts: [gpl3, copy(join(forgejoAssets, 'public/assets/licenses.txt'), 'forgejo', 'licenses.txt')],
    note: 'The program from Forgejo\'s rootless image by the core\'s pinned digest, unchanged. Its release holds its source with the Go modules it is built from; licenses.txt is its own list of those and of its JavaScript packages, with their licenses, as it serves it at /assets/licenses.txt.',
  },
  {
    name: 'Caddy',
    version: caddyVersion,
    license: 'Apache-2.0, with the Go modules it is built from under their own licenses',
    copyleft: false,
    where: ['/usr/local/bin/caddy'],
    source: `https://github.com/caddyserver/caddy/tree/${caddyVersion}`,
    texts: [apache, writeText('caddy', 'build-info.txt', `${caddyInfo}\n`), copyTree(at('caddy-modules'), 'caddy/modules')],
    note: `The program from Caddy's Alpine image by the core's pinned digest, unchanged. build-info.txt names the ${caddyModules.length} Go modules it is built from, each at its version, by \`caddy build-info\`; licenses/caddy/modules/<module>@<version>/ holds each one's licence and notice files, from its source at that version as the Go module proxy serves it, and modules.json lists them.${caddyModulesWithout.length > 0 ? ` These have no licence file at their root: ${caddyModulesWithout.map((one) => `${one.module}@${one.version}`).join(', ')}.` : ''}`,
  },
  {
    name: 'Typesense',
    version: typesenseVersion,
    license: 'GPL-3.0, with the libraries it links statically under their own licenses',
    copyleft: true,
    where: ['/usr/local/bin/typesense-server'],
    source: `https://github.com/typesense/typesense/tree/${typesenseTag}`,
    sources: typesenseDependencies,
    texts: [gpl3, writeText('typesense', 'WORKSPACE', workspace)],
    modified: `Stripped of its symbols on ${strip.date}, with \`${strip.tool} ${strip.option}\` (${strip.version}): ${strip.bytesBefore} bytes before, ${strip.bytesAfter} after. Nothing else was changed; what was removed only a debugger reads.`,
    note: `The program from Typesense's image by the core's pinned digest. It links statically what its WORKSPACE at ${typesenseTag} names, among them brpc, braft, RocksDB, h2o, OpenSSL, ICU, jemalloc and curl, each under its own license, with its source at the address below.`,
  },
  {
    name: 'libvips, with sharp',
    version: libvipsVersions[0],
    license: 'LGPL-3.0-or-later, with the libraries it bundles under their own licenses',
    copyleft: true,
    where: [...new Set(libvips.map((one) => `the ${one.name} package in the npm trees`))],
    source: `https://github.com/lovell/sharp-libvips/tree/${libvipsTag}, whose build/posix.sh fetches each library below and applies ${patches.length} patches: ${patches.join(', ')}`,
    sources: libraries,
    texts: [lgpl3, gpl3, writeText('libvips', 'versions.json', `${JSON.stringify(bundled, null, 2)}\n`), writeText('libvips', 'THIRD-PARTY-NOTICES.md', libvipsNotices)],
    note: 'The package holds no license text; these are the LGPL and the GPL it is under, and sharp-libvips\' notices of each library it bundles, at the versions versions.json names.',
  },
  {
    name: 'Konzilo Design',
    version: designPackage?.version ?? null,
    license: 'AGPL-3.0-or-later; its icons from Lucide (ISC) and Tabler (MIT)',
    copyleft: true,
    where: [`the ${designPackage?.path ?? 'node_modules/@kntnt/konzilo-design'} package in the site's npm tree`],
    source: designPackage ? `https://github.com/Kntnt/konzilo-design/tree/v${designPackage.version}` : 'https://github.com/Kntnt/konzilo-design',
    texts: designPackage ? designPackage.texts.map((text) => `/builder-work/site/${designPackage.path}/${text}`) : [],
    note: 'Its license texts are in its own folder.',
  },
  {
    name: 'Mona Sans and Mona Sans Mono',
    version: null,
    license: 'OFL-1.1',
    copyleft: false,
    where: ['/site/design/fonts', 'the site\'s releases in /public'],
    source: 'https://github.com/github/mona-sans',
    texts: fonts,
    note: 'The site\'s typefaces.',
  },
  {
    name: 'The pictures',
    version: null,
    license: 'Each picture\'s own: the Unsplash License, the Pixabay Content License, or made by an image model',
    copyleft: false,
    where: ['the demo content in Forgejo (/var/lib/gitea)', 'the builder\'s and the preview\'s checkouts', 'the site\'s releases in /public'],
    source: 'https://github.com/Kntnt/konzilo-demo/blob/main/design/images/credits.json',
    texts: [copy(at('credits.json'), 'pictures', 'credits.json')],
    note: `${pictureCount} pictures; credits.json names each one's source, author and license.`,
  },
];

function copyTree(from, part) {
  mkdirSync(join(licenses, part), { recursive: true });
  execFileSync('cp', ['-R', `${from}/.`, join(licenses, part)]);
  return `licenses/${part}/`;
}

writeFileSync(join(out, 'parts.json'), `${JSON.stringify(parts, null, 2)}\n`);
writeFileSync(join(out, 'npm-packages.json'), `${JSON.stringify(npm, null, 2)}\n`);
writeFileSync(join(out, 'debian-packages.json'), `${JSON.stringify(debian, null, 2)}\n`);

const md = [
  '# What this image holds, and under what licenses',
  '',
  'Konzilo Demo\'s image holds the parts below. Each comes under its own license, whose text is named with it: in `licenses/` beside this file, or in the part\'s own folder in the image. `parts.json` holds the same, for a program; `npm-packages.json` names every npm package in the image, and `debian-packages.json` every Debian package, with the address of its source at the version the image holds.',
  '',
  'The source of every part is where its maker publishes it, at the version the image holds, named under **Source**: for Forgejo and Typesense their releases, for libvips and each library it bundles the archives its build fetches, and for each Debian package Debian\'s snapshot archive. No copy of any source is kept in the image or beside it.',
  '',
  ...parts.flatMap((part) => [
    `## ${part.name}${part.version ? ` ${part.version}` : ''}`,
    '',
    `- **License:** ${part.license}`,
    `- **In the image:** ${part.where.join('; ')}`,
    `- **Source:** ${part.source}`,
    ...(part.texts.length > 0 ? [`- **Texts:** ${part.texts.map((text) => `\`${text}\``).join(', ')}`] : []),
    ...(part.modified ? [`- **Changed:** ${part.modified}`] : []),
    '',
    part.note,
    '',
    ...(part.sources && part.name !== 'Debian GNU/Linux' ? [...part.sources.map((one) => `- ${one.name}${one.version ? ` ${one.version}` : ''}: ${one.address}`), ''] : []),
  ]),
  ...(withoutTexts.length > 0 ? [
    '## npm packages without a license file of their own',
    '',
    'These name their license in their package.json alone; it is the license named, whose text is the standard one.',
    '',
    ...[...new Set(withoutTexts.map((one) => `- \`${one.name}\` ${one.version}: ${one.license}`))],
    '',
  ] : []),
];
writeFileSync(join(out, 'NOTICES.md'), `${md.join('\n').trimEnd()}\n`);
console.log(`gather: ${parts.length} parts, ${installed.length} npm packages, ${debian.length} Debian packages, ${libraries.length} libraries of libvips and ${typesenseDependencies.length} of Typesense with their sources, in ${out}`);
