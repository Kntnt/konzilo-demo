// What the image holds, as the notices name it: the npm packages in a tree of node_modules, and the Debian
// packages dpkg has installed. gather.mjs reads them when the image is built, and check.mjs reads the same in
// the image and holds them to what the notices name.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const TEXT = /^(licen[cs]e|copying|notice|copyright|authors|patents)([.-].*)?$/i;

// The files of a package's own folder that hold its license or notices.
export const textsIn = (folder) => readdirSync(folder).filter((name) => TEXT.test(name) && statSync(join(folder, name)).isFile()).sort();

// A license as package.json gives it, as one SPDX expression where it can.
export function licenseOf(manifest) {
  const given = manifest.license ?? manifest.licenses;
  if (typeof given === 'string') return given;
  if (Array.isArray(given)) return given.map((one) => (typeof one === 'string' ? one : one.type)).join(' OR ');
  if (given && typeof given === 'object') return given.type ?? 'UNKNOWN';
  return 'UNKNOWN';
}

// Every package in the node_modules folders below `root`, nested ones too, each with where it is relative to
// `root`, sorted by that place.
export function npmPackagesIn(root) {
  const found = [];
  const visit = (modules) => {
    if (!existsSync(modules)) return;
    for (const name of readdirSync(modules)) {
      if (name.startsWith('.')) continue;
      const path = join(modules, name);
      if (!statSync(path).isDirectory()) continue;
      if (name.startsWith('@')) {
        for (const inner of readdirSync(path)) {
          if (statSync(join(path, inner)).isDirectory()) take(join(path, inner));
        }
      } else {
        take(path);
      }
    }
  };
  const take = (folder) => {
    const file = join(folder, 'package.json');
    if (existsSync(file)) {
      const manifest = JSON.parse(readFileSync(file, 'utf8'));
      found.push({ name: manifest.name, version: manifest.version, license: licenseOf(manifest), path: relative(root, folder), texts: textsIn(folder) });
    }
    visit(join(folder, 'node_modules'));
  };
  visit(join(root, 'node_modules'));
  return found.sort((a, b) => a.path.localeCompare(b.path));
}

// The packages of dpkg's status file that are installed, each with the source package and version it was built
// from, which Debian's archive keeps.
export function debianPackagesIn(status) {
  return status.split(/\n\n+/).map((stanza) => {
    const field = (name) => new RegExp(`^${name}: (.*)$`, 'm').exec(stanza)?.[1];
    if (!field('Package') || !/install ok installed/.test(field('Status') ?? '')) return null;
    const version = field('Version');
    const [, sourceName, sourceVersion] = /^(\S+)(?: \((.+)\))?$/.exec(field('Source') ?? field('Package'));
    return { package: field('Package'), version, architecture: field('Architecture'), source: sourceName, sourceVersion: sourceVersion ?? version };
  }).filter(Boolean).sort((a, b) => a.package.localeCompare(b.package));
}

// What a Debian package's copyright file says its licenses are, by its machine-readable `License:` lines, where
// it has them.
export function debianLicensesIn(copyright) {
  return [...new Set([...copyright.matchAll(/^License: *([^\n]+)$/gm)].map((match) => match[1].trim()))].sort();
}

// What the notices leave without the address of its source: a part under a copyleft license, anything such a part
// bundles, a Debian package, or a library libvips bundles (`bundled`, as its versions.json names them, by name)
// at the version the image holds. Each as a line to print; none when all is addressed.
export function unsourced({ parts, debian, bundled = {} }) {
  const addressed = (text) => /https?:\/\//.test(text ?? '');
  const problems = [];
  for (const part of parts.filter((one) => one.copyleft)) {
    if (!addressed(part.source)) problems.push(`${part.name}, under a copyleft license, has no address of its source`);
    for (const one of part.sources ?? []) if (!addressed(one.address)) problems.push(`${part.name}: ${one.name} has no address of its source`);
  }
  for (const name of ['Forgejo', 'Typesense', 'libvips, with sharp', 'Debian GNU/Linux']) {
    if (!parts.find((one) => one.name === name)?.copyleft) problems.push(`the notices do not name ${name} as a part under a copyleft license`);
  }
  for (const one of debian) if (!addressed(one.sourceAddress)) problems.push(`the Debian package ${one.package} ${one.version} has no address of its source`);
  const libvips = parts.find((one) => one.name === 'libvips, with sharp');
  for (const [library, version] of Object.entries(bundled)) {
    const named = libvips?.sources?.find((source) => source.name === library);
    if (!named || named.version !== version || !addressed(named.address)) problems.push(`libvips bundles ${library} ${version}, whose source the notices do not name at that version`);
  }
  return problems;
}
