// What the image's checks share: the image started as a visitor starts it, what it prints, its memory, and a
// person signed in through the sign-in pages' buttons in a real browser.

import { execFileSync, spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';

import { PEOPLE, PORTS } from '../runtime/programs.mjs';

const require = createRequire(import.meta.url);
export const playwright = require('playwright-core');
export const origin = (name) => `http://localhost:${PORTS[name]}`;
export const person = (role) => PEOPLE.find((one) => one.role === role);
export const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const started = Date.now();
export const say = (line) => console.log(`[${((Date.now() - started) / 1000).toFixed(1).padStart(6)} s] ${line}`);

export const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
export const quietly = (...args) => {
  try {
    return docker(...args);
  } catch {
    return null;
  }
};

// The visitor's command, as it is typed, with no terminal: `docker run --rm -p 127.0.0.1:8080-8083:8080-8083
// <image>`, with a name the check can find it by and any options of the check's own before the image. Resolves
// once it prints that it is ready, with what it printed and how long that took from the command.
export async function startImage({ tag, name, options = [], readyWithinMs = 600_000 }) {
  if (quietly('ps', '-aq', '--filter', `name=^${name}$`)) throw new Error(`a container named ${name} exists already`);
  const args = ['run', '--rm', '--name', name, '-p', '127.0.0.1:8080-8083:8080-8083', ...options, tag];
  const t0 = Date.now();
  const child = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let printed = '';
  child.stdout.on('data', (chunk) => {
    printed += chunk;
  });
  child.stderr.on('data', (chunk) => {
    printed += chunk;
  });
  const exited = new Promise((resolve) => child.on('close', (code, signal) => resolve({ code, signal, at: Date.now() })));
  const until = Date.now() + readyWithinMs;
  while (!/^Ready in /m.test(printed)) {
    const ended = await Promise.race([exited, pause(50).then(() => null)]);
    if (ended) throw new Error(`the image stopped before it was ready (${ended.code ?? ended.signal}):\n${printed}`);
    if (Date.now() > until) throw new Error(`the image was not ready within ${readyWithinMs / 1000} s:\n${printed}`);
  }
  const readySeconds = (Date.now() - t0) / 1000;
  // The rest of what it prints when ready comes in the same moment.
  await pause(300);
  return {
    child,
    name,
    readySeconds,
    printed: () => printed,
    exited,
    // Ctrl-C in the terminal, which reaches the client as SIGINT; resolves to how long the client took to return.
    async interrupt(signal = 'SIGINT') {
      const sent = Date.now();
      child.kill(signal);
      const ended = await Promise.race([exited, pause(30_000).then(() => null)]);
      if (!ended) throw new Error(`the client had not returned 30 s after ${signal}`);
      return { seconds: (ended.at - sent) / 1000, code: ended.code, signal: ended.signal };
    },
  };
}

// The container's memory now, in MiB, as `docker stats` gives it.
export function memory(name) {
  const text = quietly('stats', '--no-stream', '--format', '{{.MemUsage}}', name);
  const found = /^([\d.]+)\s*([KMG]i?B)/.exec(text ?? '');
  if (!found) return null;
  const scale = { KiB: 1 / 1024, KB: 1 / 1024, MiB: 1, MB: 1, GiB: 1024, GB: 1024 }[found[2]];
  return Number(found[1]) * scale;
}

// The highest memory while `work` runs, sampled about every second.
export async function peakWhile(name, work) {
  let peak = 0;
  let running = true;
  const sampling = (async () => {
    while (running) {
      peak = Math.max(peak, memory(name) ?? 0);
      await pause(500);
    }
  })();
  try {
    return { result: await work(), peak: () => peak };
  } finally {
    running = false;
    await sampling;
  }
}

// Until the builder's first build after the start is done.
export async function firstBuildDone(name, withinMs = 900_000) {
  const until = Date.now() + withinMs;
  while (quietly('exec', name, 'test', '-f', '/tmp/built') === null) {
    if (Date.now() > until) throw new Error('the builder\'s first build after the start took too long');
    await pause(1000);
  }
}

// That a start installed nothing: npm keeps its cache in a program's home, which the image holds none of, so a
// start that ran npm in the builder's or the preview's copy of the site leaves one.
export function installedNothing(name) {
  const left = ['/builder-work/home/.npm', '/preview-work/home/.npm'].filter((path) => quietly('exec', name, 'test', '-e', path) !== null);
  if (left.length > 0) throw new Error(`a start ran npm: ${left.join(', ')}`);
}

// A browser of `engine`, whose pages' errors are noted.
export async function openBrowser(engine = 'chromium') {
  const browser = await playwright[engine].launch();
  const errors = [];
  const context = async () => {
    const made = await browser.newContext({ locale: 'en-GB', viewport: { width: 1400, height: 900 } });
    made.on('page', (page) => watch(page));
    return made;
  };
  const watch = (page) => {
    page.on('pageerror', (error) => errors.push(`${page.url()}: ${error.message}`));
  };
  return { browser, context, errors };
}

// Forgejo's sign-in and second-factor pages, gone through on `page` as a visitor does with the demo's buttons:
// the person's button, then the form's own button, then the person's code button, then the form's own Verify.
// `onRefused(page)` is called when Forgejo refuses the code; the visitor then presses the code button again.
export async function throughForgejo(page, who, { onRefused } = {}) {
  const panel = page.locator('#konzilo-demo-people');
  await panel.waitFor({ timeout: 30_000 });
  await panel.getByRole('button', { name: `${who.role}: ${who.name}` }).click();
  const filled = { user: await page.locator('#user_name').inputValue(), password: await page.locator('#password').inputValue() };
  if (filled.user !== who.user || filled.password !== who.password) throw new Error(`the ${who.role}'s button filled in ${JSON.stringify(filled)}`);
  await page.locator('form[action*="/user/login"]').getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/\/user\/two_factor/);
  for (let attempt = 1; ; attempt += 1) {
    const codeButton = page.locator('#konzilo-demo-people').getByRole('button', { name: `${who.name}'s code` });
    await codeButton.click();
    await page.waitForFunction(() => /^\d{6}$/.test(document.querySelector('input[name="passcode"]')?.value ?? ''), null, { timeout: 45_000 });
    await page.locator('input[name="passcode"]').evaluate((field) => field.form.querySelector('button.primary, button[type="submit"], button:not([type])').click());
    const outcome = await Promise.race([
      page.waitForEvent('close').then(() => 'closed').catch(() => null),
      page.waitForURL((url) => !/\/user\/(two_factor|login)/.test(url.pathname), { timeout: 30_000 }).then(() => 'through').catch(() => null),
      page.locator('.flash-error, .ui.negative.message').waitFor({ timeout: 30_000 }).then(() => 'refused').catch(() => null),
    ]);
    if (outcome === 'refused') {
      if (attempt > 2) throw new Error(`Forgejo refused ${who.user}'s code ${attempt} times`);
      await onRefused?.(page);
      continue;
    }
    if (!outcome) throw new Error(`nothing happened when ${who.user}'s code was sent`);
    return { attempts: attempt, outcome };
  }
}

// A sign-in to the editor: its button, the popup through Forgejo, and the editor's collections.
export async function signInToEditor(context, who, options) {
  const page = await context.newPage();
  await page.goto(`${origin('admin')}/`);
  const button = page.getByRole('button', { name: /Forgejo/ });
  await button.waitFor({ timeout: 60_000 });
  await page.waitForTimeout(1000);
  const [popup] = await Promise.all([context.waitForEvent('page'), button.click()]);
  const through = await throughForgejo(popup, who, options);
  return { page, ...through };
}

const failed = (message) => {
  throw new Error(message);
};

// An article of the public site's feed, the first or the one `index` says: its title and address.
export async function anArticle(index = 0) {
  const feed = await (await fetch(`${origin('site')}/insights/feed/`)).text();
  const item = [...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)][index]?.[1] ?? failed(`the feed has no item ${index + 1}`);
  const decode = (text) => text.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, '\'');
  return { title: decode(/<title>([\s\S]*?)<\/title>/.exec(item)[1]).trim(), link: decode(/<link>([\s\S]*?)<\/link>/.exec(item)[1]).trim() };
}

// A tab of the live preview, until it shows a page of the site and not the gate's own, within `withinMs`.
export async function previewTab(context, withinMs = 240_000) {
  const tab = await context.newPage();
  const opened = Date.now();
  await tab.goto(`${origin('preview')}/`, { timeout: withinMs });
  for (;;) {
    const html = await tab.content().catch(() => '');
    if (/<main[\s>]/.test(html) && !/Starting the preview/i.test(html)) break;
    if (Date.now() - opened > withinMs) failed(`the preview did not show a page within ${withinMs / 1000} s: ${tab.url()}`);
    await tab.waitForTimeout(500);
  }
  return { tab, seconds: (Date.now() - opened) / 1000 };
}

// A save in the editor's own form, by whoever is signed in on `page`, timed until the public site shows it, within
// `withinMs`; with the container's peak memory meanwhile.
export async function save(page, name, withinMs = 300_000, index = 0) {
  const article = await anArticle(index);
  const headline = `${article.title} (saved by the check ${new Date().toISOString().slice(11, 19)})`;
  await page.goto(`${origin('admin')}/#/collections/articles`);
  await page.getByText(article.title, { exact: true }).first().click({ timeout: 60_000 });
  const field = page.getByRole('textbox', { name: 'Main headline' });
  await field.waitFor({ timeout: 60_000 });
  await field.fill(headline);
  const { result, peak } = await peakWhile(name, async () => {
    const saved = Date.now();
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    for (;;) {
      // A connection the web server closes as it takes a new release's rules is tried again, as a browser does.
      const html = await fetch(article.link, { cache: 'no-store' }).then((answer) => answer.text()).catch(() => '');
      if (html.includes(headline.replace(/&/g, '&amp;')) || html.includes(headline)) return (Date.now() - saved) / 1000;
      if (Date.now() - saved > withinMs) failed(`the save was not live on ${article.link} within ${withinMs / 1000} s`);
      if (!quietly('ps', '-q', '--filter', `name=^${name}$`)) failed('the image stopped while the save was being built');
      await pause(1000);
    }
  });
  return { seconds: result, peak: peak(), link: article.link };
}

// The posts of the source repository as the image's seed made them, read in the container through Forgejo, with
// the core's own YAML reader: each with its collection, title, status, date and the address the site gives it.
export function sourcePosts(name) {
  const script = `
    import { readFileSync } from 'node:fs';
    import { createRequire } from 'node:module';
    const { parse } = createRequire('/konzilo/package.json')('yaml');
    const token = readFileSync('/state/instance-token', 'utf8').trim();
    const repository = process.env.KONZILO_REPOSITORY ?? 'ampfield/source';
    const api = async (path) => (await fetch('http://127.0.0.1:3000/api/v1/repos/' + repository + path, { headers: { authorization: 'token ' + token } })).json();
    const site = JSON.parse(readFileSync('/site/site-description.json', 'utf8'));
    const types = Object.values(site.types ?? {});
    const { tree } = await api('/git/trees/main?recursive=true&per_page=10000');
    const posts = [];
    for (const { path, type } of tree) {
      const collection = path.split('/')[0];
      const kind = types.find((one) => one.collection === collection);
      if (type !== 'blob' || !path.endsWith('.md') || !kind) continue;
      const file = await api('/contents/' + path.split('/').map(encodeURIComponent).join('/'));
      const text = Buffer.from(file.content, 'base64').toString('utf8');
      const fields = parse(/^---\\n([\\s\\S]*?)\\n---/.exec(text)?.[1] ?? '') ?? {};
      const address = kind.address && fields.slug ? kind.address.replace('{slug}', fields.slug).replace('{path}', fields.slug) : null;
      posts.push({ path, collection, title: fields.title, status: fields.status, date: fields.date ? new Date(fields.date).toISOString() : null, address });
    }
    process.stdout.write(JSON.stringify(posts));
  `;
  return JSON.parse(docker('exec', '--env', 'KONZILO_REPOSITORY=ampfield/source', name, 'node', '--input-type=module', '-e', script));
}

// What the image holds of a scheduled post: every post dated after the image was built is scheduled, and each
// scheduled one is absent from the public site, its address and its feed, and shown as scheduled on the editor's
// Publishing page, where `page` is signed in. Gives the titles it checked; none where the demo content holds no post
// dated ahead.
export async function scheduledPosts(name, page) {
  const built = JSON.parse(docker('exec', name, 'cat', '/konzilo-demo/release.json')).created;
  const posts = sourcePosts(name);
  if (posts.length === 0) failed('the source repository holds no posts');
  const ahead = posts.filter((post) => post.status !== 'scheduled' && post.date && post.date > built);
  if (ahead.length > 0) failed(`dated after the image was built (${built}), yet seeded otherwise than scheduled: ${ahead.map((post) => `${post.path} (${post.status})`).join(', ')}`);
  const scheduled = posts.filter((post) => post.status === 'scheduled');
  for (const post of scheduled) {
    if (post.address) {
      const answer = await fetch(`${origin('site')}${post.address}`, { redirect: 'manual' });
      if (answer.status !== 404) failed(`the scheduled post ${post.path} answers ${answer.status} at ${post.address} on the public site`);
    }
    for (const listing of [`${origin('site')}/insights/feed/`, `${origin('site')}/insights/`]) {
      const text = await (await fetch(listing)).text();
      if (post.title && text.includes(post.title)) failed(`the scheduled post "${post.title}" is in ${listing}`);
    }
    const search = await (await fetch(`${origin('site')}/_konzilo/search?q=${encodeURIComponent(post.title)}`)).json();
    if (!Array.isArray(search.hits)) failed(`search did not answer: ${JSON.stringify(search).slice(0, 200)}`);
    if (search.hits.some((hit) => hit.document?.title === post.title || (post.address && hit.document?.address === post.address))) failed(`search finds the scheduled post "${post.title}"`);
    await page.goto(`${origin('admin')}/#/collections/${post.collection}`);
    await page.getByRole('radio', { name: 'Publishing' }).click({ timeout: 60_000 });
    await page.getByRole('row', { name: new RegExp(post.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) }).getByText(/Scheduled: goes live/).waitFor({ timeout: 60_000 });
  }
  return { built, scheduled: scheduled.map((post) => `${post.title} (${post.date})`), posts: posts.length };
}

// A person's current second-factor code, made here from the key the image's seed keeps for them, at Forgejo's
// own time, and never one already given: it waits for the next half minute when `after` is this one's code.
export async function codeOf(name, who, { after } = {}) {
  const file = who.user === person('Admin').user ? '/state/account-totp' : `/state/people/${who.user}-totp`;
  const key = docker('exec', name, 'cat', file).trim();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...key].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const secret = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const at = (moment) => {
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(moment / 30000)));
    const digest = createHmac('sha1', secret).update(counter).digest();
    const offset = digest[digest.length - 1] & 15;
    return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
  };
  const forgejo = async () => Date.parse((await fetch(`${origin('git')}/api/healthz`)).headers.get('date')) + 500;
  let code = at(await forgejo());
  while (code === after) {
    await pause(1000);
    code = at(await forgejo());
  }
  return code;
}

// What a Reviewer may not do, tried where the editor cannot stop it: write to the source repository through
// Forgejo's own API, with the Reviewer's password and a fresh second-factor code. Forgejo must refuse with 403;
// gives its answer.
export async function reviewerWrites(name, who, { after } = {}) {
  const code = await codeOf(name, who, { after });
  const path = `articles/written-by-the-reviewer-${Date.now()}.md`;
  const answer = await fetch(`${origin('git')}/api/v1/repos/ampfield/source/contents/${path}`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${who.user}:${who.password}`).toString('base64')}`,
      'x-forgejo-otp': code,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ content: Buffer.from('---\ntitle: "Not mine to write"\n---\nA Reviewer wrote this.\n').toString('base64'), message: 'A Reviewer tries to write' }),
  });
  const text = await answer.text();
  if (answer.status !== 403) failed(`Forgejo answered the Reviewer's write with ${answer.status}, not 403: ${text.slice(0, 200)}`);
  return { status: answer.status, message: (() => {
    try {
      return JSON.parse(text).message;
    } catch {
      return text.slice(0, 120);
    }
  })() };
}

