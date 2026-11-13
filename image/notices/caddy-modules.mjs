#!/usr/bin/env node
// When the image is built, in the Dockerfile's stage `caddy-modules`: the licence and notice files of every Go
// module Caddy is built from, at the version `caddy build-info` names, from the module's source as the Go module
// proxy serves it (a zip of `<module>@<version>/...`). Only what is needed of each zip is fetched: its central
// directory, by a range from its end, and then the files at the module's root whose names say they are its
// licence, notice, copying terms, patent grant or authors. Each lands in <out>/<module>@<version>/, and
// <out>/modules.json lists every module with its files, empty where it has none. The build stops when a module
// cannot be read.
//
//   node caddy-modules.mjs <caddy program> <folder to write>

import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const PROXY = 'https://proxy.golang.org';
const TEXT = /^(licen[cs]e|copying|notice|patents|authors|unlicense)([.-][^/]*)?$/i;

// A module path as the proxy spells it: each capital letter as `!` and the letter in lower case.
export const escaped = (path) => path.replace(/[A-Z]/g, (letter) => `!${letter.toLowerCase()}`);

// The modules a Go program's build information names, each with the version it was built with, a replacement
// standing for the module it replaces.
export function modulesOf(buildInfo) {
  const modules = [];
  for (const line of buildInfo.split('\n')) {
    const [kind, path, version] = line.trim().split(/\s+/);
    if (kind === 'dep') modules.push({ path, version });
    else if (kind === '=>' && modules.length > 0) modules[modules.length - 1] = { path, version, replaces: modules.at(-1).path };
  }
  return modules;
}

async function range(url, start, end) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      const answer = await fetch(url, { headers: { range: end === undefined ? `bytes=${start}` : `bytes=${start}-${end}` }, signal: AbortSignal.timeout(60_000) });
      if (answer.status !== 206 && answer.status !== 200) throw new Error(`${answer.status}`);
      const bytes = Buffer.from(await answer.arrayBuffer());
      const total = Number(/\/(\d+)$/.exec(answer.headers.get('content-range') ?? '')?.[1] ?? bytes.length);
      return { bytes, total, whole: answer.status === 200 };
    } catch (error) {
      if (attempt === 4) throw new Error(`caddy-modules: could not fetch ${url}: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

// The files at a module's root that hold its licence or notices, read from its zip at the proxy.
export async function textsOf({ path, version }) {
  const url = `${PROXY}/${escaped(path)}/@v/${escaped(version)}.zip`;
  let tail = await range(url, '-65536');
  const whole = tail.whole ? tail.bytes : null;
  const at = (offset, length) => (whole ? { bytes: whole.subarray(offset, offset + length) } : range(url, offset, offset + length - 1));
  const end = tail.bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error(`caddy-modules: ${url} has no end of central directory`);
  const size = tail.bytes.readUInt32LE(end + 12);
  const offset = tail.bytes.readUInt32LE(end + 16);
  const tailStart = whole ? 0 : tail.total - tail.bytes.length;
  const directory = offset >= tailStart ? tail.bytes.subarray(offset - tailStart, offset - tailStart + size) : (await at(offset, size)).bytes;
  const root = `${path}@${version}/`;
  const texts = [];
  for (let p = 0; p + 46 <= directory.length;) {
    if (directory.readUInt32LE(p) !== 0x02014b50) break;
    const method = directory.readUInt16LE(p + 10);
    const compressed = directory.readUInt32LE(p + 20);
    const nameLength = directory.readUInt16LE(p + 28);
    const extraLength = directory.readUInt16LE(p + 30);
    const commentLength = directory.readUInt16LE(p + 32);
    const local = directory.readUInt32LE(p + 42);
    const name = directory.subarray(p + 46, p + 46 + nameLength).toString('utf8');
    p += 46 + nameLength + extraLength + commentLength;
    if (!name.startsWith(root) || name.endsWith('/')) continue;
    const file = name.slice(root.length);
    if (file.includes('/') || !TEXT.test(file)) continue;
    const header = (await at(local, 30)).bytes;
    const start = local + 30 + header.readUInt16LE(26) + header.readUInt16LE(28);
    const data = compressed === 0 ? Buffer.alloc(0) : (await at(start, compressed)).bytes;
    texts.push({ file, contents: method === 8 ? inflateRawSync(data) : data });
  }
  return texts;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [caddy, out] = process.argv.slice(2);
  const modules = modulesOf(execFileSync(caddy, ['build-info'], { encoding: 'utf8' }));
  const listed = [];
  const queue = [...modules];
  await Promise.all(Array.from({ length: 8 }, async () => {
    for (let module = queue.shift(); module; module = queue.shift()) {
      const texts = await textsOf(module);
      const folder = join(out, `${module.path}@${module.version}`);
      mkdirSync(folder, { recursive: true });
      for (const { file, contents } of texts) writeFileSync(join(folder, file), contents);
      listed.push({ module: module.path, version: module.version, ...(module.replaces ? { replaces: module.replaces } : {}), texts: texts.map(({ file }) => file).sort() });
    }
  }));
  listed.sort((a, b) => a.module.localeCompare(b.module));
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'modules.json'), `${JSON.stringify(listed, null, 2)}\n`);
  const without = listed.filter((one) => one.texts.length === 0);
  console.log(`caddy-modules: ${listed.length} modules, ${listed.reduce((sum, one) => sum + one.texts.length, 0)} files${without.length > 0 ? `; with no licence file at their root: ${without.map((one) => `${one.module}@${one.version}`).join(', ')}` : ''}`);
}
