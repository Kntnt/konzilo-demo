#!/usr/bin/env node
// Both architectures: the image built for linux/amd64 and linux/arm64 at once, its size for each, and the one
// that is not this machine's started under emulation as a visitor would start it: its programs are the target's,
// it answers on all four origins, it searches, its first build after the start ends well, the Admin signs in
// through the buttons, the live preview starts, a save is built with the target's native packages (the intake's
// pictures, Astro and the index) and goes live, and Ctrl-C stops it.
//
//   npm run image:check:arches
//   npm run image:check:arches -- --no-build
//   npm run image:check:arches -- --no-cache    the build's every step anew, for its time on a fresh machine
//
// The ports 8080-8083 must be free.

import { parseArgs } from 'node:util';

import { buildImage, DEFAULT_TAG, HERE } from '../build.mjs';
import { docker, firstBuildDone, installedNothing, memory, openBrowser, origin, pause, person, previewTab, quietly, save, say, signInToEditor, startImage } from './lib.mjs';

const { values } = parseArgs({ options: { 'no-build': { type: 'boolean', default: false }, 'no-cache': { type: 'boolean', default: false }, tag: { type: 'string', default: DEFAULT_TAG }, site: { type: 'string', default: 'HEAD' } } });
const tag = values.tag;
const NAME = 'kdemo-img-check-arch';
const OTHER = HERE === 'linux/arm64' ? 'linux/amd64' : 'linux/arm64';
const MACHINE = { 'linux/amd64': 'x86_64', 'linux/arm64': 'aarch64' };
const results = {};
const fail = (message) => {
  throw new Error(message);
};

try {
  if (quietly('ps', '-aq', '--filter', `name=^${NAME}$`)) fail(`a container named ${NAME} is there already`);
  if (!values['no-build']) {
    const built = await buildImage({ tag, platform: 'both', site: values.site, noCache: values['no-cache'] });
    results.buildSeconds = Math.round(built.seconds);
    say(`built for both in ${results.buildSeconds} s`);
  }
  results.sizes = quietly('image', 'ls', '--tree', tag);
  say(`the image for each architecture:\n${results.sizes}`);

  // Each variant runs as its machine, and each program in it is built for that machine: an ELF file's e_machine,
  // two bytes at offset 18, is 3e 00 for x86-64 and b7 00 for AArch64.
  const ELF = { 'linux/amd64': '3e 00', 'linux/arm64': 'b7 00' };
  for (const platform of ['linux/amd64', 'linux/arm64']) {
    const programs = ['/usr/local/bin/node', '/usr/local/bin/forgejo', '/usr/local/bin/caddy', '/usr/local/bin/typesense-server'];
    const lines = docker('run', '--rm', '--platform', platform, '--entrypoint', 'sh', tag, '-c', `uname -m; for p in ${programs.join(' ')}; do od -An -tx1 -j18 -N2 "$p"; done`).split('\n').map((line) => line.trim());
    if (lines[0] !== MACHINE[platform]) fail(`the image for ${platform} runs as ${lines[0]}`);
    const wrong = programs.filter((_, index) => lines[index + 1] !== ELF[platform]);
    if (wrong.length > 0) fail(`in the image for ${platform}, ${wrong.join(', ')} are built for another machine`);
    say(`${platform}: runs as ${lines[0]}, its programs built for it`);
  }

  say(`${OTHER}, under emulation: docker run --rm --platform ${OTHER} -p 127.0.0.1:8080-8083:8080-8083 ${tag}`);
  const run = await startImage({ tag, name: NAME, options: ['--platform', OTHER] });
  const printed = run.printed();
  results.readySeconds = Number(run.readySeconds.toFixed(1));
  results.supervisorSeconds = Number(/^Ready in ([\d.]+) seconds/m.exec(printed)?.[1]);
  say(`ready ${results.readySeconds} s after the command (the supervisor's own clock: ${results.supervisorSeconds} s). It printed:\n${printed}`);

  const statuses = {};
  for (const [name, path] of [['site', '/'], ['admin', '/'], ['git', '/user/login'], ['preview', '/_konzilo/preview/health']]) {
    statuses[name] = (await fetch(`${origin(name)}${path}`, { redirect: 'manual' })).status;
  }
  say(`the four origins answer: ${JSON.stringify(statuses)}`);
  if (Object.values(statuses).some((status) => status >= 500)) fail('an origin answered with an error');
  await firstBuildDone(NAME, 1_800_000);
  installedNothing(NAME);
  say('the first build after the start ended well under emulation, and the start installed nothing');
  const search = await (await fetch(`${origin('site')}/_konzilo/search?q=solar`)).json();
  results.searchHits = search.found ?? search.hits?.length ?? null;
  if (!results.searchHits) fail(`search found nothing: ${JSON.stringify(search).slice(0, 300)}`);
  say(`search for "solar" found ${results.searchHits}`);
  await pause(5000);
  results.idle = memory(NAME);
  say(`idle memory under emulation: ${Math.round(results.idle)} MiB`);

  const { browser, context } = await openBrowser();
  try {
    const admin = person('Admin');
    const editorContext = await context();
    const signedIn = await signInToEditor(editorContext, admin);
    await signedIn.page.getByText('Articles').first().waitFor({ timeout: 120_000 });
    say(`the Admin is signed in through the buttons under emulation (${signedIn.attempts} code${signedIn.attempts === 1 ? '' : 's'})`);
    const preview = await previewTab(editorContext, 600_000);
    results.previewSeconds = Number(preview.seconds.toFixed(1));
    results.withPreview = memory(NAME);
    say(`the live preview showed "${await preview.tab.title()}" ${results.previewSeconds} s after its tab was opened; memory ${Math.round(results.withPreview)} MiB`);
    // A save, which the target's native packages build: the intake's pictures, Astro and the index.
    const saved = await save(signedIn.page, NAME, 900_000);
    results.saveSeconds = Number(saved.seconds.toFixed(1));
    results.peakWithPreviewAndBuild = saved.peak;
    say(`the Admin's save was live at ${saved.link} ${results.saveSeconds} s after Save, built under emulation; peak memory ${Math.round(saved.peak)} MiB`);
  } finally {
    await browser.close();
  }

  const stopped = await run.interrupt('SIGINT');
  results.stopSeconds = Number(stopped.seconds.toFixed(1));
  const left = quietly('ps', '-aq', '--filter', `name=^${NAME}$`);
  say(`Ctrl-C: the command returned ${results.stopSeconds} s later with status ${stopped.code}; the container is ${left ? 'still there' : 'gone'}`);
  if (left || stopped.code !== 0) fail('the image did not stop cleanly');
  console.log(`\nimage:check:arches: every step passed\n${JSON.stringify(results, null, 2)}`);
} catch (error) {
  console.error(`\nimage:check:arches: ${error.stack ?? error.message}`);
  quietly('rm', '-f', NAME);
  process.exit(1);
}
