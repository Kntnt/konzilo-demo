// Forgejo's app.ini, from the settings the core's compose.yaml gives Forgejo, so that one list holds them for
// Compose and for this image alike. Forgejo's own image turns its FORGEJO__ variables into app.ini with
// environment-to-ini, which is linked against musl and does not run on Debian; the forgejo program reads no
// such variable itself.
//
//   node app-ini.mjs <compose.yaml> <app.ini to write> [<the core, whose yaml package reads it>]

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { userInfo } from 'node:os';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

// Compose's ${NAME}, ${NAME:-fallback} and ${NAME-fallback}, from `environment`.
export function substitute(value, environment) {
  return String(value).replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?:(:?-)([^}]*))?\}/g, (_, name, how, fallback) => {
    const given = environment[name];
    if (how === ':-') return given === undefined || given === '' ? fallback : given;
    if (how === '-') return given === undefined ? fallback : given;
    if (given === undefined) throw new Error(`compose.yaml names \${${name}}, which nothing sets`);
    return given;
  });
}

// The settings, section by section: what the vendor's rootless image writes from its own template, then
// Compose's, then what one container needs: its user, and Forgejo on the loopback alone.
export function settingsOf(compose, { environment, user, work = '/var/lib/gitea', temp = '/tmp/gitea' }) {
  const given = compose['x-forgejo']?.environment;
  if (!given) throw new Error('compose.yaml has no x-forgejo block with an environment');
  const settings = {
    DEFAULT: { APP_NAME: 'Forgejo: Beyond coding. We forge.', RUN_USER: user, RUN_MODE: 'prod', WORK_PATH: work },
    repository: { ROOT: `${work}/git/repositories` },
    'repository.local': { LOCAL_COPY_PATH: `${temp}/local-repo` },
    'repository.upload': { TEMP_PATH: `${temp}/uploads` },
    server: { APP_DATA_PATH: work },
    database: { PATH: `${work}/data/gitea.db` },
    session: { PROVIDER_CONFIG: `${work}/data/sessions` },
    picture: { AVATAR_UPLOAD_PATH: `${work}/data/avatars`, REPOSITORY_AVATAR_UPLOAD_PATH: `${work}/data/repo-avatars` },
    attachment: { PATH: `${work}/data/attachments` },
    log: { ROOT_PATH: `${work}/data/log` },
    security: { REVERSE_PROXY_LIMIT: '1' },
    lfs: { PATH: `${work}/git/lfs` },
  };
  for (const [name, value] of Object.entries(given)) {
    const found = /^FORGEJO__(.+)__([A-Za-z0-9_]+)$/.exec(name);
    if (!found) throw new Error(`compose.yaml gives Forgejo ${name}, which is no FORGEJO__section__KEY`);
    const [, section, key] = found;
    (settings[section] ??= {})[key] = substitute(value, environment);
  }
  settings.server.HTTP_ADDR = '127.0.0.1';
  return settings;
}

export function iniOf(settings) {
  const lines = [];
  for (const [section, values] of Object.entries(settings)) {
    if (section !== 'DEFAULT') lines.push('', `[${section}]`);
    for (const [key, value] of Object.entries(values)) {
      if (/[\n\r]/.test(String(value))) throw new Error(`the setting ${section}.${key} holds a line break`);
      lines.push(`${key} = ${value}`);
    }
  }
  return `${lines.join('\n').trim()}\n`;
}

export function writeAppIni({ composeFile, out, core = '/konzilo', environment = process.env, user = userInfo().username }) {
  const { parse } = createRequire(pathToFileURL(`${core}/package.json`))('yaml');
  const compose = parse(readFileSync(composeFile, 'utf8'), { merge: true });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, iniOf(settingsOf(compose, { environment, user })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [composeFile, out, core] = process.argv.slice(2);
  writeAppIni({ composeFile, out, core });
}
