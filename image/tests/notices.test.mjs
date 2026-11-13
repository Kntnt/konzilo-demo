// What the notices read of the image, and the rule that every part under a copyleft license names its source.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import { escaped, modulesOf } from '../notices/caddy-modules.mjs';
import { debianLicensesIn, debianPackagesIn, licenseOf, npmPackagesIn, unsourced } from '../notices/walk.mjs';

const folder = mkdtempSync(join(tmpdir(), 'notices-test-'));
after(() => rmSync(folder, { recursive: true, force: true }));

const npmPackage = (path, manifest, texts = []) => {
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'package.json'), JSON.stringify(manifest));
  for (const text of texts) writeFileSync(join(path, text), 'text');
};

// Parts as gather.mjs writes them, each copyleft one with its source.
const parts = () => [
  { name: 'Forgejo', copyleft: true, source: 'https://codeberg.org/forgejo/forgejo/releases/tag/v17.0.1' },
  { name: 'Typesense', copyleft: true, source: 'https://github.com/typesense/typesense/tree/v30.2', sources: [{ name: 'rocksdb', address: 'https://github.com/facebook/rocksdb/archive/v1.tar.gz' }] },
  { name: 'libvips, with sharp', copyleft: true, source: 'https://github.com/lovell/sharp-libvips/tree/v1.3.4', sources: [{ name: 'vips', version: '8.18.7', address: 'https://github.com/libvips/libvips/releases/download/v8.18.7/vips-8.18.7.tar.xz' }] },
  { name: 'Debian GNU/Linux', copyleft: true, source: 'https://snapshot.debian.org/package/<source>/<version>/' },
  { name: 'Caddy', copyleft: false, source: 'https://github.com/caddyserver/caddy/tree/v2.11.7' },
];
const debian = [{ package: 'git', version: '1:2.39.5-0+deb12u2', sourceAddress: 'https://snapshot.debian.org/package/git/1%3A2.39.5-0%2Bdeb12u2/' }];

describe('the notices', () => {
  test('find every npm package in a tree, scoped and nested, with the files that hold its license', () => {
    const root = join(folder, 'tree');
    npmPackage(join(root, 'node_modules/a'), { name: 'a', version: '1.0.0', license: 'MIT' }, ['LICENSE']);
    npmPackage(join(root, 'node_modules/@s/b'), { name: '@s/b', version: '2.0.0', license: { type: 'ISC' } }, ['LICENCE.md', 'NOTICE']);
    npmPackage(join(root, 'node_modules/a/node_modules/c'), { name: 'c', version: '3.0.0', licenses: [{ type: 'MIT' }, { type: 'Apache-2.0' }] });
    mkdirSync(join(root, 'node_modules/.bin'), { recursive: true });
    assert.deepEqual(npmPackagesIn(root), [
      { name: '@s/b', version: '2.0.0', license: 'ISC', path: 'node_modules/@s/b', texts: ['LICENCE.md', 'NOTICE'] },
      { name: 'a', version: '1.0.0', license: 'MIT', path: 'node_modules/a', texts: ['LICENSE'] },
      { name: 'c', version: '3.0.0', license: 'MIT OR Apache-2.0', path: 'node_modules/a/node_modules/c', texts: [] },
    ]);
    assert.equal(licenseOf({}), 'UNKNOWN');
  });

  test('read dpkg\'s installed packages, each with the source it was built from', () => {
    const status = [
      'Package: git\nStatus: install ok installed\nArchitecture: arm64\nSource: git (1:2.39.5-0+deb12u2)\nVersion: 1:2.39.5-0+deb12u2',
      'Package: libc6\nStatus: install ok installed\nArchitecture: arm64\nSource: glibc\nVersion: 2.36-9+deb12u10',
      'Package: gone\nStatus: deinstall ok config-files\nVersion: 1',
      'Package: tini\nStatus: install ok installed\nArchitecture: arm64\nVersion: 0.19.0-1',
    ].join('\n\n');
    assert.deepEqual(debianPackagesIn(status), [
      { package: 'git', version: '1:2.39.5-0+deb12u2', architecture: 'arm64', source: 'git', sourceVersion: '1:2.39.5-0+deb12u2' },
      { package: 'libc6', version: '2.36-9+deb12u10', architecture: 'arm64', source: 'glibc', sourceVersion: '2.36-9+deb12u10' },
      { package: 'tini', version: '0.19.0-1', architecture: 'arm64', source: 'tini', sourceVersion: '0.19.0-1' },
    ]);
    assert.deepEqual(debianLicensesIn('License: GPL-2\n\nFiles: x\nLicense: LGPL-2.1+\nLicense: GPL-2\n'), ['GPL-2', 'LGPL-2.1+']);
  });

  test('find nothing unsourced when every copyleft part, Debian package and library of libvips has its address', () => {
    assert.deepEqual(unsourced({ parts: parts(), debian, bundled: { vips: '8.18.7' } }), []);
  });

  test('fail when a part under the GPL or the LGPL has no source line', () => {
    const without = parts().map((part) => (part.name === 'Forgejo' ? { ...part, source: 'its maker\'s site' } : part));
    assert.deepEqual(unsourced({ parts: without, debian }), ['Forgejo, under a copyleft license, has no address of its source']);
    const missing = parts().filter((part) => part.name !== 'Typesense');
    assert.deepEqual(unsourced({ parts: missing, debian }), ['the notices do not name Typesense as a part under a copyleft license']);
    const bundledWithout = parts().map((part) => (part.name === 'Typesense' ? { ...part, sources: [{ name: 'rocksdb', address: null }] } : part));
    assert.deepEqual(unsourced({ parts: bundledWithout, debian }), ['Typesense: rocksdb has no address of its source']);
  });

  test('fail when a Debian package, or a library libvips bundles at the version the image holds, has no source line', () => {
    assert.deepEqual(unsourced({ parts: parts(), debian: [{ package: 'bash', version: '5.2', sourceAddress: '' }] }), ['the Debian package bash 5.2 has no address of its source']);
    assert.deepEqual(unsourced({ parts: parts(), debian, bundled: { vips: '8.19.0', glib: '2.90.0' } }), [
      'libvips bundles vips 8.19.0, whose source the notices do not name at that version',
      'libvips bundles glib 2.90.0, whose source the notices do not name at that version',
    ]);
  });

  test('read the Go modules a program is built from, a replacement in the place of what it replaces, and spell them as the module proxy does', () => {
    const info = 'go\tgo1.26.8\npath\tcaddy\nmod\tcaddy\t(devel)\t\ndep\tcel.dev/expr\tv0.25.3\th1:A=\ndep\tgithub.com/Old/one\tv1.0.0\th1:B=\n=>\tgithub.com/New/one\tv1.0.1\th1:C=\n';
    assert.deepEqual(modulesOf(info), [
      { path: 'cel.dev/expr', version: 'v0.25.3' },
      { path: 'github.com/New/one', version: 'v1.0.1', replaces: 'github.com/Old/one' },
    ]);
    assert.equal(escaped('github.com/BurntSushi/toml'), 'github.com/!burnt!sushi/toml');
  });
});
