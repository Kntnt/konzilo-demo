#!/usr/bin/env node
// The image as a visitor meets it, on this machine's architecture: built, started by the visitor's command, and
// used in a real browser through the sign-in pages' buttons alone; then stopped with Ctrl-C. It measures as it
// goes and prints what it found, and exits 1 at the first thing that is not as it should be.
//
//   npm run image:check                          build, then check
//   npm run image:check -- --no-build            check the image as it is
//   npm run image:check -- --engine firefox      in Firefox or WebKit rather than Chromium
//   npm run image:check -- --limits              also run it within --memory 2g --cpus 2
//
// What it does: the build, with its time and the image's sizes; the notices' own check in the image; a start,
// timed to the printed addresses, whose lines it holds to plain ASCII with the version and the day; the Admin
// signed in to the editor, and the same person again within the same half minute, which Forgejo refuses until the
// button has waited for the next code, and a save of the Admin's live on the public site; the Editor signed in,
// the live preview opened in a tab of its own, and a save, timed until it is live on the public site; a post
// dated after the build scheduled, absent from the public site, its list, its feed and its search, and shown so
// in the editor; the Reviewer signed in to the live preview, refused by the editor, and refused by Forgejo when
// writing to the source through its API; the memory idle and with the preview and a build running; Ctrl-C, timed; and a start in which a
// program dies, which the supervisor must name and stop at. The ports 8080-8083 must be free.

import { parseArgs } from 'node:util';

import { buildImage, DEFAULT_TAG } from '../build.mjs';
import { docker, firstBuildDone, installedNothing, memory, openBrowser, origin, pause, person, previewTab, quietly, reviewerWrites, codeOf, save, say, scheduledPosts, signInToEditor, startImage, throughForgejo } from './lib.mjs';

const { values } = parseArgs({
  options: {
    'no-build': { type: 'boolean', default: false },
    tag: { type: 'string', default: DEFAULT_TAG },
    site: { type: 'string', default: 'HEAD' },
    engine: { type: 'string', default: 'chromium' },
    limits: { type: 'boolean', default: false },
  },
});
const tag = values.tag;
const NAME = 'kdemo-img-check';
const results = {};
const fail = (message) => {
  throw new Error(message);
};
const mib = (value) => (value === null ? 'unknown' : `${Math.round(value)} MiB`);

// --- The build and the image's sizes.
async function build() {
  if (values['no-build']) return;
  const built = await buildImage({ tag, site: values.site });
  results.buildSeconds = Math.round(built.seconds);
  say(`built in ${results.buildSeconds} s`);
}

function sizes() {
  const unpacked = Number(docker('image', 'inspect', '--format', '{{.Size}}', tag));
  results.unpackedMB = Math.round(unpacked / 1e6);
  const tree = quietly('image', 'ls', '--tree', tag);
  results.sizes = tree;
  say(`the image: ${results.unpackedMB} MB unpacked\n${tree ?? ''}`);
}

function notices() {
  const output = docker('run', '--rm', '--entrypoint', 'node', tag, '/konzilo-demo/notices/check.mjs');
  say(output);
}

// --- What it prints.
function printedLines(printed) {
  const lines = printed.split('\n');
  const bad = lines.filter((line) => !/^[\x20-\x7e]*$/.test(line));
  if (bad.length > 0) fail(`it printed lines that are not plain ASCII:\n${bad.join('\n')}`);
  if (!/^Konzilo Demo \S+, built \d{4}-\d{2}-\d{2}, on Konzilo \S+\.$/m.test(printed)) fail(`it did not name its version and day:\n${printed}`);
  for (const port of [8080, 8081, 8082, 8083]) if (!printed.includes(`http://localhost:${port}`)) fail(`it did not print http://localhost:${port}`);
  for (const role of ['Admin', 'Editor', 'Reviewer']) if (!printed.includes(person(role).password)) fail(`it did not print the ${role}'s password`);
}

// --- A run as a visitor, with everything the browser does.
async function visit({ options = [], label, full = true }) {
  say(`${label}: docker run --rm -p 127.0.0.1:8080-8083:8080-8083 ${options.join(' ')}${options.length ? ' ' : ''}${tag}`);
  const run = await startImage({ tag, name: NAME, options });
  try {
    return await visiting(run, { label, full });
  } catch (error) {
    error.message = `${error.message}\nThe image printed last:\n${run.printed().trim().split('\n').slice(-20).join('\n')}`;
    throw error;
  }
}

async function visiting(run, { label, full }) {
  const printed = run.printed();
  const own = /^Ready in ([\d.]+) seconds/m.exec(printed)?.[1];
  say(`${label}: ready ${run.readySeconds.toFixed(1)} s after the command (the supervisor's own clock: ${own} s). It printed:\n${printed}`);
  printedLines(printed);
  const result = { readySeconds: Number(run.readySeconds.toFixed(1)), supervisorSeconds: Number(own) };

  const { browser, context, errors } = await openBrowser(values.engine);
  try {
    await firstBuildDone(NAME);
    await pause(5000);
    result.idle = memory(NAME);
    installedNothing(NAME);
    say(`${label}: the first build after the start is done, and the start installed nothing; idle memory ${mib(result.idle)}`);

    if (full) {
      // The Admin, at the start of a half minute, and at once again in another browser: Forgejo has taken the
      // code, refuses it, and the button waits for the next.
      while ((Date.now() / 1000) % 30 > 2) await pause(200);
      const admin = person('Admin');
      const first = await signInToEditor(await context(), admin);
      await first.page.getByText('Articles').first().waitFor({ timeout: 60_000 });
      say(`${label}: the Admin, ${admin.name}, is signed in to the editor through the buttons`);
      let notice = null;
      const again = await signInToEditor(await context(), admin, {
        onRefused: async (page) => {
          notice = await page.locator('.konzilo-demo-notice').textContent();
        },
      });
      result.secondSignIn = { attempts: again.attempts, notice };
      say(`${label}: the Admin again, within the same half minute: ${again.attempts === 1 ? 'Forgejo took the first code (the period had turned)' : `refused once, with the notice "${notice}", then through with the next code`}`);
      const adminSaved = await save(first.page, NAME, 300_000, 1);
      result.adminSaveSeconds = Number(adminSaved.seconds.toFixed(1));
      say(`${label}: the Admin's save was live at ${adminSaved.link} ${result.adminSaveSeconds} s after Save`);
    }

    // The Editor, the preview, and a save.
    const editor = person('Editor');
    const editorContext = await context();
    const signedIn = await signInToEditor(editorContext, editor);
    await signedIn.page.getByText('Articles').first().waitFor({ timeout: 60_000 });
    say(`${label}: the Editor, ${editor.name}, is signed in to the editor`);
    const preview = await previewTab(editorContext);
    result.previewSeconds = Number(preview.seconds.toFixed(1));
    await pause(3000);
    result.withPreview = memory(NAME);
    say(`${label}: the live preview showed "${await preview.tab.title()}" ${result.previewSeconds} s after its tab was opened; memory ${mib(result.withPreview)}`);
    const saved = await save(signedIn.page, NAME);
    result.saveSeconds = Number(saved.seconds.toFixed(1));
    result.peakWithPreviewAndBuild = saved.peak;
    say(`${label}: the Editor's save was live at ${saved.link} ${result.saveSeconds} s after Save; peak memory with the preview and the build ${mib(saved.peak)}`);
    if (full) {
      const scheduled = await scheduledPosts(NAME, signedIn.page);
      result.scheduled = scheduled.scheduled;
      say(`${label}: ${scheduled.scheduled.length === 0 ? `of the ${scheduled.posts} posts the seed made, none is dated after the image was built (${scheduled.built}), so none is scheduled` : `scheduled, absent from the public site, its list, its feed and its search, and shown so on the editor's Publishing page: ${scheduled.scheduled.join('; ')}`}`);
    }

    if (full) {
      // The Reviewer: the live preview, and a refusal from the editor.
      const reviewer = person('Reviewer');
      const reviewerContext = await context();
      const page = await reviewerContext.newPage();
      await page.goto(`${origin('preview')}/`);
      await throughForgejo(page, reviewer);
      const shown = await previewTab(reviewerContext);
      const editLinks = await shown.tab.locator(`a[href^="${origin('admin')}"]`).count();
      if (editLinks > 0) fail('the preview offers the Reviewer a link to edit');
      say(`${label}: the Reviewer, ${reviewer.name}, reads the live preview ("${await shown.tab.title()}"), with no link to edit`);
      const editorPage = await reviewerContext.newPage();
      await editorPage.goto(`${origin('admin')}/`);
      const button = editorPage.getByRole('button', { name: /Forgejo/ });
      await button.waitFor();
      await editorPage.waitForTimeout(1000);
      await button.click();
      const refusal = editorPage.getByText(/reads the site's live preview only/);
      await refusal.waitFor({ timeout: 60_000 });
      result.reviewerRefused = (await refusal.textContent()).trim();
      say(`${label}: the editor refused the Reviewer: "${result.reviewerRefused}"`);
      const written = await reviewerWrites(NAME, reviewer, { after: await codeOf(NAME, reviewer) });
      result.reviewerWrite = written.status;
      say(`${label}: Forgejo refused the Reviewer's write to the source through its API, with a fresh code: ${written.status} "${written.message}"`);
    }
    if (errors.length > 0) say(`${label}: the pages reported errors:\n  ${errors.join('\n  ')}`);
    result.pageErrors = errors.length;
  } finally {
    await browser.close();
  }

  const stopped = await run.interrupt('SIGINT');
  result.stopSeconds = Number(stopped.seconds.toFixed(1));
  result.stopStatus = stopped.code;
  const left = quietly('ps', '-aq', '--filter', `name=^${NAME}$`);
  say(`${label}: Ctrl-C (SIGINT): the command returned ${result.stopSeconds} s later with status ${stopped.code}; the container is ${left ? 'still there' : 'gone'}. It printed last:\n${run.printed().trim().split('\n').slice(-2).join('\n')}`);
  if (left) fail('the container is still there after Ctrl-C');
  if (stopped.code !== 0) fail(`the command ended with ${stopped.code} after Ctrl-C`);
  return result;
}

// --- A program that dies: the supervisor names it, shows its last lines, and stops with status 1.
async function dying() {
  const run = await startImage({ tag, name: NAME });
  const before = run.printed().length;
  docker('exec', NAME, 'node', '-e', `
    const { readdirSync, readFileSync } = require('node:fs');
    for (const pid of readdirSync('/proc').filter((name) => /^\\d+$/.test(name))) {
      try {
        if (readFileSync('/proc/' + pid + '/cmdline', 'utf8').includes('konzilo-service.js\\0visitors')) process.kill(Number(pid), 'SIGKILL');
      } catch {}
    }`);
  const ended = await Promise.race([run.exited, pause(30_000).then(() => null)]);
  const after = run.printed().slice(before);
  say(`a program killed: the command ended with ${ended?.code}. The supervisor printed:\n${after}`);
  if (!ended || ended.code !== 1) fail('the image did not stop with status 1 when a program died');
  if (!/The visitors' service stopped unexpectedly, by the signal SIGKILL\./.test(after)) fail('the supervisor did not name the program that died');
  if (!/could not run/.test(after)) fail('the supervisor did not say that the demo could not run');
  return { status: ended.code };
}

try {
  if (quietly('ps', '-aq', '--filter', `name=^${NAME}$`)) fail(`a container named ${NAME} is there already`);
  await build();
  sizes();
  notices();
  results.visit = await visit({ label: 'visit' });
  results.dying = await dying();
  if (values.limits) results.limited = await visit({ label: 'limited', options: ['--memory', '2g', '--cpus', '2'], full: false });
  console.log(`\nimage:check: every step passed\n${JSON.stringify(results, null, 2)}`);
} catch (error) {
  console.error(`\nimage:check: ${error.stack ?? error.message}`);
  quietly('rm', '-f', NAME);
  process.exit(1);
}
