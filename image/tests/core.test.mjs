// Where the image takes the core from: what the site pins, and whether a packed core is the tag's source.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, test } from 'node:test';

import { CORE_SOURCE, pinOf, tarballDiffers } from '../lib/core.mjs';

const folder = mkdtempSync(join(tmpdir(), 'core-test-'));
after(() => rmSync(folder, { recursive: true, force: true }));

describe('the core', () => {
  test('reads the pins a site may have', () => {
    const pinned = (spec) => pinOf({ dependencies: { '@kntnt/konzilo': spec } });
    assert.deepEqual(pinned('github:Kntnt/konzilo#v0.4.0'), { kind: 'tag', spec: 'github:Kntnt/konzilo#v0.4.0', tag: 'v0.4.0' });
    assert.equal(pinned('git+https://github.com/Kntnt/konzilo.git#v0.5.0').tag, 'v0.5.0');
    assert.deepEqual(pinned('file:vendor/kntnt-konzilo-0.5.0.tgz'), { kind: 'file', spec: 'file:vendor/kntnt-konzilo-0.5.0.tgz', path: 'vendor/kntnt-konzilo-0.5.0.tgz' });
    assert.equal(pinned('0.5.0').version, '0.5.0');
    assert.throws(() => pinned('github:Someone/else#main'), /cannot take/);
    assert.throws(() => pinOf({ dependencies: {} }), /does not depend/);
  });

  test('tells every file of a packed core that differs from the source', () => {
    const source = join(folder, 'source');
    const packed = join(folder, 'pack', 'package');
    for (const root of [source, packed]) {
      mkdirSync(join(root, 'src'), { recursive: true });
      writeFileSync(join(root, 'package.json'), '{"version":"0.5.0"}\n');
      writeFileSync(join(root, 'src/a.js'), 'export const a = 1;\n');
    }
    const tarball = join(folder, 'core.tgz');
    execFileSync('tar', ['-czf', tarball, '-C', join(folder, 'pack'), 'package']);
    assert.deepEqual(tarballDiffers(tarball, source), []);
    writeFileSync(join(packed, 'src/a.js'), 'export const a = 2;\n');
    writeFileSync(join(packed, 'src/b.js'), 'export const b = 1;\n');
    execFileSync('tar', ['-czf', tarball, '-C', join(folder, 'pack'), 'package']);
    assert.deepEqual(tarballDiffers(tarball, source).sort(), ['src/a.js', 'src/b.js']);
  });

  test('takes the core from one of the two places, which one line chooses', () => {
    assert.ok(['integration', 'pinned'].includes(CORE_SOURCE.from));
  });
});
