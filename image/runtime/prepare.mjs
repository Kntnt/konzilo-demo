#!/usr/bin/env node
// When the image is built, in the Dockerfile's stage `prepare`: what a first start of the core's Compose project
// does, done once, so that each start of the image takes seconds. Forgejo's setup (the core's init.sh), the seed
// (the core's seed.js) with the demo's three people, the sign-in pages' buttons, the builder's first build with
// its search index, and the preview's copy of the site; then everything stopped cleanly, and the state it left
// written to one tar, which the Dockerfile copies into the image for each target.
//
//   node prepare.mjs <state tar to write>
//
// It runs as `node`, with the network, and with /run/secrets on a tmpfs, where it writes the passwords the
// core's scripts read, so that none of them is in a layer: the people's, which people.json holds and the sign-in
// pages show, and the instance's, made at random here and kept nowhere.

import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

import { writeAppIni } from './app-ini.mjs';
import { ADMIN, BUILT, ENVIRONMENT, environmentOf, FORGEJO_ENVIRONMENT, FORGEJO_HOME, FORGEJO_INI, PEOPLE, PROGRAMS } from './programs.mjs';

// Every folder that holds state, as Compose has a volume for each; base.sh makes them, given to `node`.
const STATE = ['/var/lib/gitea', '/typesense-data', '/typesense-secret', '/state', '/builder-secret', '/preview-secret',
  '/editors-secret', '/builder-work', '/preview-work', '/public', '/admin-config', '/control', '/thumbnails',
  '/search-route', '/service-data', '/caddy'];
const LOGS = '/tmp/prepare-logs';
const SECRETS = '/run/secrets';
const FOOTER = `${FORGEJO_HOME}/custom/templates/custom/footer.tmpl`;

const out = process.argv[2];
const started = Date.now();
const say = (line) => console.log(`prepare [${((Date.now() - started) / 1000).toFixed(1).padStart(6)} s] ${line}`);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
mkdirSync(LOGS, { recursive: true });
const running = new Map();

const tail = (name, lines = 40) => {
  try {
    return readFileSync(`${LOGS}/${name}.log`, 'utf8').split('\n').slice(-lines).join('\n');
  } catch {
    return '(no log)';
  }
};

// A program of programs.mjs, or a command of its own, started in a process group of its own with its output in
// a log; `exited` settles when it ends.
function start(name, { command = PROGRAMS[name].command, environment = environmentOf(PROGRAMS[name] ?? {}), cwd = '/' } = {}) {
  const log = createWriteStream(`${LOGS}/${name}.log`, { flags: 'a' });
  const child = spawn(command[0], command.slice(1), { env: environment, cwd, stdio: ['ignore', 'pipe', 'pipe'], detached: true });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  child.exited = new Promise((resolve) => child.on('close', (code, signal) => {
    running.delete(name);
    resolve(code ?? signal);
  }));
  running.set(name, child);
  return child;
}

// Runs a command to its end, its output in a log of its own, and stops the build if it fails.
async function run(name, command, environment, cwd) {
  const status = await start(name, { command, environment, cwd }).exited;
  if (status !== 0) throw new Error(`${name} ended with ${status}:\n${tail(name)}`);
}

async function answering(name, seconds = 120) {
  const until = Date.now() + seconds * 1000;
  const child = running.get(name);
  while (Date.now() < until) {
    if (!running.has(name)) throw new Error(`${name} stopped while it was awaited:\n${tail(name)}`);
    if (await PROGRAMS[name].ready()) return;
    await pause(200);
  }
  throw new Error(`${name} did not answer within ${seconds} s${child ? '' : ' (it never started)'}:\n${tail(name)}`);
}

async function stopAll() {
  const children = [...running.values()];
  for (const child of children) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // gone already
    }
  }
  const late = setTimeout(() => children.forEach((child) => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // gone already
    }
  }), 10_000);
  await Promise.all(children.map((child) => child.exited));
  clearTimeout(late);
}

const instanceToken = () => readFileSync('/state/instance-token', 'utf8').trim();
const forgejoApi = async (method, path, body) => {
  const answer = await fetch(`${ENVIRONMENT.KONZILO_PEER_FORGEJO}/api/v1${path}`, {
    method,
    headers: { authorization: `token ${instanceToken()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!answer.ok) throw new Error(`${method} ${path}: ${answer.status} ${await answer.text()}`);
};

async function prepare() {
  // The passwords the core's scripts read from Compose's secrets.
  writeFileSync(`${SECRETS}/instance-password`, `${randomBytes(24).toString('base64url')}\n`, { mode: 0o600 });
  writeFileSync(`${SECRETS}/account-password`, `${ADMIN.password}\n`, { mode: 0o600 });
  for (const person of PEOPLE) writeFileSync(`${SECRETS}/account-password-${person.user}`, `${person.password}\n`, { mode: 0o600 });

  // Forgejo's setup, as Compose's forgejo-init does it with the core's init.sh, from an app.ini written from the
  // settings compose.yaml gives Forgejo.
  for (const folder of [FORGEJO_ENVIRONMENT.HOME, FORGEJO_ENVIRONMENT.GITEA_TEMP]) mkdirSync(folder, { recursive: true, mode: 0o700 });
  writeAppIni({ composeFile: '/konzilo/compose/compose.yaml', out: FORGEJO_INI, environment: { ...process.env, ...ENVIRONMENT } });
  const forgejoEnvironment = { ...process.env, ...FORGEJO_ENVIRONMENT };
  await run('forgejo-init', ['sh', '/konzilo/compose/forgejo/init.sh'], forgejoEnvironment);
  say('Forgejo is set up');

  start('forgejo');
  start('web');
  await Promise.all([answering('forgejo'), answering('web')]);
  say('Forgejo and the web server answer');

  await run('seed', ['node', '/konzilo/compose/seed/seed.js'], environmentOf({}));
  say(`seeded, with ${PEOPLE.map((person) => `${person.user} as the ${person.role}`).join(', ')}`);
  // The demo's own: each person's full name, which the editor shows.
  for (const person of PEOPLE) {
    await forgejoApi('PATCH', `/admin/users/${person.user}`, { full_name: person.name, login_name: person.user, source_id: 0 });
  }
  await run('buttons', ['node', '/konzilo-demo/buttons/footer.mjs', FOOTER], environmentOf({}));
  say('the sign-in pages have their buttons');

  start('typesense');
  await answering('typesense');
  say('search answers');
  start('builder');
  const until = Date.now() + 30 * 60 * 1000;
  while (!existsSync(BUILT)) {
    if (!running.has('builder')) throw new Error(`the builder stopped before its first build was done:\n${tail('builder', 80)}`);
    if (Date.now() > until) throw new Error(`the builder's first build took more than 30 minutes:\n${tail('builder', 80)}`);
    await pause(500);
  }
  if (/could not be made|unindexed/i.test(tail('builder', 200))) throw new Error(`the builder's first build made no search index:\n${tail('builder', 60)}`);
  say('the builder\'s first build is done, with the search index');

  // The preview's copy of the site, as the preview makes it at its start, in the site's folder.
  await run('preview-copy', ['sh', '/konzilo/compose/builder/prepare-site.sh', PROGRAMS.preview.environment.KONZILO_FOLDER_WORK, '--exclude=./content', '--exclude=./demo-content'], environmentOf(PROGRAMS.preview), '/site');
  mkdirSync('/preview-work/site/content', { recursive: true });
  say('the preview\'s copy of the site is made');

  await stopAll();
  say('everything stopped');

  // What would hold the build's own traces, or is made again at need.
  for (const path of [BUILT, '/tmp/gitea', '/builder-work/home/.npm', '/preview-work/home/.npm', '/builder-work/home/.cache', '/preview-work/home/.cache']) {
    rmSync(path, { recursive: true, force: true });
  }
  const missing = ['/public/current', '/search-route/search-route.caddy', '/admin-config/config.json', FOOTER]
    .filter((path) => !existsSync(path));
  if (missing.length > 0) throw new Error(`the first start left no ${missing.join(', ')}\n--- the builder's last lines\n${tail('builder', 60)}\n--- Typesense's last lines\n${tail('typesense', 20)}`);

  const tar = spawnSync('tar', ['-cf', out, '-C', '/', ...STATE.map((folder) => folder.slice(1))], { stdio: 'inherit' });
  if (tar.status !== 0) throw new Error('the state could not be written to its tar');
  say(`the state is in ${out}`);
}

try {
  await prepare();
  rmSync(LOGS, { recursive: true, force: true });
} catch (error) {
  console.error(`prepare: ${error.stack ?? error.message}`);
  for (const name of running.keys()) console.error(`--- the last lines of ${name}\n${tail(name)}`);
  await stopAll();
  process.exit(1);
}
