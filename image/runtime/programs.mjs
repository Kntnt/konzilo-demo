// The programs of one Konzilo site, as Compose runs them in containers of their own (the core's
// compose/compose.yaml), arranged here in one container: what each is started with, what tells that it answers,
// and in which order they start. The supervisor runs them at each start, and prepare.mjs, when the image is
// built, runs some of them as a first start of Compose does.

import { existsSync, readFileSync } from 'node:fs';

// The four origins, each a port on localhost, the same inside the container and outside, since Forgejo's own
// address, its answers for large files and the sign-in's redirects all name it.
export const PORTS = { site: 8080, admin: 8081, git: 8082, preview: 8083 };
export const origin = (port) => `http://localhost:${port}`;

// The site's name: Forgejo's organisation, the search collection, and the prefix of its cookies.
export const SITE = 'ampfield';

const DEMO = new URL('./', import.meta.url).pathname;
export const PEOPLE = JSON.parse(readFileSync(`${DEMO}people.json`, 'utf8')).people;
export const ADMIN = PEOPLE.find((person) => person.role === 'Admin');

// What Compose gives the core's services, the same for every program here; and where each program reaches its
// peers, on the loopback, and keeps its own folders, by the settings the core's compose/README.md lists under
// "What another arrangement sets".
export const ENVIRONMENT = {
  KONZILO_SITE: SITE,
  KONZILO_ACCOUNT: ADMIN.user,
  // The people the seed makes, each with the role of its team (Kntnt/konzilo#71).
  KONZILO_PEOPLE: PEOPLE.map((person) => `${person.user}:${person.team.replace(/s$/, '')}`).join(','),
  KONZILO_REPOSITORY: `${SITE}/source`,
  KONZILO_PORT_SITE: String(PORTS.site),
  KONZILO_PORT_ADMIN: String(PORTS.admin),
  KONZILO_PORT_GIT: String(PORTS.git),
  KONZILO_PORT_PREVIEW: String(PORTS.preview),
  KONZILO_ORIGIN: origin(PORTS.site),
  KONZILO_SITE_ORIGIN: origin(PORTS.site),
  KONZILO_ADMIN_ORIGIN: origin(PORTS.admin),
  KONZILO_FORGEJO_ORIGIN: origin(PORTS.git),
  KONZILO_PREVIEW_ORIGIN: origin(PORTS.preview),
  KONZILO_MAIL_TO_LOG: 'true',
  ASTRO_TELEMETRY_DISABLED: '1',
  KONZILO_PEER_FORGEJO: 'http://127.0.0.1:3000',
  KONZILO_PEER_TYPESENSE: 'http://127.0.0.1:8108',
  KONZILO_PEER_EDITORS: 'http://127.0.0.1:4100',
  KONZILO_PEER_VISITORS: 'http://127.0.0.1:4200',
  KONZILO_PEER_PREVIEW: 'http://127.0.0.1:4000',
  KONZILO_LISTEN: '127.0.0.1',
  KONZILO_WEBHOOK_HOST: 'loopback',
};

// Forgejo as its rootless image runs it, with its settings in app.ini, which prepare.mjs writes.
export const FORGEJO_HOME = '/var/lib/gitea';
export const FORGEJO_INI = `${FORGEJO_HOME}/custom/conf/app.ini`;
export const FORGEJO_ENVIRONMENT = {
  GITEA_WORK_DIR: FORGEJO_HOME,
  GITEA_CUSTOM: `${FORGEJO_HOME}/custom`,
  GITEA_APP_INI: FORGEJO_INI,
  GITEA_TEMP: '/tmp/gitea',
  TMPDIR: '/tmp/gitea',
  HOME: `${FORGEJO_HOME}/git`,
};

// The file the builder writes when its first build after a start is done, in temporary space, which every
// start begins without (compose.yaml's health check of the builder).
export const BUILT = '/tmp/built';

// Something that answers: an HTTP answer that `ok` accepts, within two seconds.
const answers = (url, ok = (answer) => answer.ok) => async () => {
  try {
    return await ok(await fetch(url, { signal: AbortSignal.timeout(2000) }));
  } catch {
    return false;
  }
};

// Each program: who it is to a visitor reading the terminal, its command, its own environment, and what says
// that it answers. A program with `background` is not waited for before the site is ready.
export const PROGRAMS = {
  forgejo: {
    label: 'Forgejo',
    command: ['forgejo', 'web'],
    environment: FORGEJO_ENVIRONMENT,
    ready: answers('http://127.0.0.1:3000/api/healthz'),
  },
  typesense: {
    label: 'Typesense',
    command: ['typesense-server', '--data-dir', '/typesense-data', '--config', '/typesense-secret/typesense.ini',
      '--api-address', '127.0.0.1', '--api-port', '8108', '--peering-address', '127.0.0.1', '--peering-port', '8107',
      '--reset-peers-on-error'],
    ready: answers('http://127.0.0.1:8108/health', async (answer) => answer.ok && (await answer.json()).ok === true),
  },
  web: {
    label: 'Caddy',
    command: ['caddy', 'run', '--config', '/konzilo/compose/web/Caddyfile', '--adapter', 'caddyfile', '--watch'],
    environment: { XDG_CONFIG_HOME: '/caddy/config', XDG_DATA_HOME: '/caddy/data' },
    ready: answers(`http://127.0.0.1:${PORTS.site}/`, (answer) => answer.status < 500),
  },
  visitors: {
    label: "the visitors' service",
    command: ['node', '/konzilo/bin/konzilo-service.js', 'visitors'],
    ready: answers('http://127.0.0.1:4200/health'),
  },
  editors: {
    label: "the editors' service",
    command: ['node', '/konzilo/bin/konzilo-service.js', 'editors'],
    environment: { KONZILO_FOLDER_SECRET: '/editors-secret' },
    ready: answers('http://127.0.0.1:4100/health'),
  },
  preview: {
    label: 'the live preview',
    command: ['node', '/konzilo/bin/konzilo-preview.js'],
    environment: { KONZILO_FOLDER_SECRET: '/preview-secret', KONZILO_FOLDER_WORK: '/preview-work' },
    ready: answers('http://127.0.0.1:4000/_konzilo/preview/health'),
  },
  builder: {
    label: 'the builder',
    command: ['node', '/konzilo/bin/konzilo-builder.js'],
    environment: { KONZILO_FOLDER_SECRET: '/builder-secret', KONZILO_FOLDER_WORK: '/builder-work' },
    ready: async () => existsSync(BUILT),
    background: true,
  },
};

// The order of a start: Forgejo, search, the web server and the visitors' service at once; and, once they
// answer, what reaches Forgejo and search: the editors' service, the preview and the builder. The site is
// ready when all but the builder answer; the release the image holds is served while the builder's first build
// after the start runs on.
export const START = [
  ['forgejo', 'typesense', 'web', 'visitors'],
  ['editors', 'preview', 'builder'],
];

// The environment a program is started with.
export const environmentOf = (program, base = process.env) => ({ ...base, ...ENVIRONMENT, ...program.environment });
