#!/usr/bin/env node
// Builds the image: the one way to build it, since the Dockerfile needs the core's source as a named context and
// the core's pinned versions as arguments.
//
//   npm run image:build                        for this machine's architecture, loaded into the engine
//   npm run image:build -- --platform both     for linux/amd64 and linux/arm64
//   npm run image:build -- --platform linux/amd64 --tag <name> --tag <name> --version <text>
//   npm run image:build -- --output <file>     an OCI archive instead of loading it
//   npm run image:build -- --push              pushed to the registry the tags name, instead of loading it
//   npm run image:build -- --builder <name>    on that builder; else kdemo-img-builder, made when missing
//   npm run image:build -- --core-only         take the core and check it, and build nothing
//   npm run image:build -- --site worktree     the site as the working tree holds it, not as HEAD does
//   npm run image:build -- --site <commit>     the site as that commit holds it
//   npm run image:build -- --no-cache          every step anew, as on a machine that has built nothing
//
// The site is taken as the commit HEAD holds it, or another commit given, so that the image is the revision its
// labels name, whatever is being changed beside it; the image's own files (image/, Dockerfile, .dockerignore) as
// they are. It builds on a buildx builder of its own, by name, with the docker-container driver, so that its cache
// is in that builder's own volume and never in the engine's shared one: `docker buildx du --builder <name>` says
// how large it is, and `docker buildx rm <name>` removes it with its cache. It prints where the core came from
// and how long the build took. The tag is kdemo-img-konzilo-demo:dev unless one is given; a release gives
// ghcr.io/kntnt/konzilo-demo, with its version and `latest`.

import { execFileSync, spawn } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { arch, tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';

import { takeCore } from './lib/core.mjs';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const DEFAULT_TAG = 'kdemo-img-konzilo-demo:dev';
export const DEFAULT_BUILDER = process.env.KONZILO_DEMO_BUILDER ?? 'kdemo-img-builder';

// What a registry's page of the image reads, as annotations on the index and each manifest when it is pushed;
// the image's labels say the same (Dockerfile).
const ANNOTATIONS = {
  'org.opencontainers.image.title': 'Konzilo Demo',
  'org.opencontainers.image.description': 'A demonstration website on Konzilo, for the fictional Ampfield Energy, with its editor, live preview and Forgejo, in one image.',
  'org.opencontainers.image.source': 'https://github.com/Kntnt/konzilo-demo',
  'org.opencontainers.image.licenses': 'AGPL-3.0-or-later',
};

// The builder, made with the docker-container driver where it is not there yet.
export function ensureBuilder(name) {
  try {
    execFileSync('docker', ['buildx', 'inspect', name], { stdio: 'ignore' });
  } catch {
    execFileSync('docker', ['buildx', 'create', '--name', name, '--driver', 'docker-container', '--bootstrap'], { stdio: ['ignore', 'ignore', 'inherit'] });
    console.log(`image:build: made the builder ${name}`);
  }
}
export const HERE = `linux/${arch() === 'x64' ? 'amd64' : arch()}`;
const BOTH = 'linux/amd64,linux/arm64';

// The pins the Dockerfile takes, from the core's versions.env, read as the core says it is read.
export function versionsOf(core) {
  const text = execFileSync('sh', [join(core, 'scripts/versions')], { encoding: 'utf8' });
  const pins = Object.fromEntries(text.trim().split('\n').map((line) => line.split('=')));
  const wanted = ['NODE_RELEASE', 'NODE_DIGEST', 'FORGEJO', 'FORGEJO_DIGEST', 'CADDY', 'CADDY_DIGEST', 'TYPESENSE', 'TYPESENSE_DIGEST'];
  const missing = wanted.filter((key) => !pins[key]);
  if (missing.length > 0) throw new Error(`the core's versions.env pins no ${missing.join(', ')}`);
  return Object.fromEntries(wanted.map((key) => [key, pins[key]]));
}

const gitHere = (...args) => {
  try {
    return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return '';
  }
};

// What the image says of itself: its version, from the repository's tag where HEAD has one, marked where what
// it was built from is not all committed, the moment it was built, and the commit it was built from.
export function releaseOf({ version, site = 'HEAD' } = {}) {
  const worktree = site === 'worktree';
  const commit = worktree ? 'HEAD' : site;
  const changed = gitHere('status', '--porcelain', '--', ...(worktree ? ['.'] : ['image', 'Dockerfile', '.dockerignore'])) !== '';
  return {
    version: version ?? `${gitHere('describe', '--tags', '--always', commit) || 'unknown'}${changed ? '-dirty' : ''}`,
    created: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    revision: gitHere('rev-parse', commit) || 'unknown',
  };
}

// The build's main context, the site: a commit's, unpacked with the working tree's .dockerignore, or the working
// tree itself.
function siteContext(site, scratch) {
  if (site === 'worktree') return ROOT;
  if (!gitHere('rev-parse', '--verify', `${site}^{commit}`)) throw new Error(`--site is ${site}, which is neither worktree nor a commit`);
  const folder = join(scratch, 'site');
  mkdirSync(folder);
  execFileSync('sh', ['-c', 'git -C "$1" archive --format=tar "$2" | tar -xf - -C "$3"', 'sh', ROOT, site, folder]);
  copyFileSync(join(ROOT, '.dockerignore'), join(folder, '.dockerignore'));
  return folder;
}

// Builds; resolves to { seconds, core, release, tag, platforms }.
export async function buildImage({ platform = HERE, tag = DEFAULT_TAG, version, output, push = false, builder = DEFAULT_BUILDER, site = 'HEAD', quiet = false, coreOnly = false, noCache = false } = {}) {
  const platforms = platform === 'both' ? BOTH : platform;
  const tags = [tag].flat();
  const scratch = mkdtempSync(join(tmpdir(), 'konzilo-demo-image-'));
  try {
    // The site first, since the core is the one it pins.
    const context = siteContext(site, scratch);
    const core = takeCore({ site: context, into: scratch });
    console.log(`image:build: ${core.note}`);
    const versions = versionsOf(core.folder);
    if (coreOnly) return { core, versions };
    const release = releaseOf({ version, site });
    ensureBuilder(builder);
    const args = [
      'buildx', 'build',
      '--builder', builder,
      '--file', join(ROOT, 'Dockerfile'),
      '--platform', platforms,
      '--build-context', `core=${core.folder}`,
      '--build-context', `image=${join(ROOT, 'image')}`,
      ...Object.entries(versions).flatMap(([key, value]) => ['--build-arg', `${key}=${value}`]),
      '--build-arg', `IMAGE_VERSION=${release.version}`,
      '--build-arg', `IMAGE_CREATED=${release.created}`,
      '--build-arg', `IMAGE_REVISION=${release.revision}`,
      '--build-arg', `CORE_DESCRIBED=${core.described}`,
      ...tags.flatMap((one) => ['--tag', one]),
      '--progress', quiet ? 'quiet' : 'plain',
      ...(noCache ? ['--no-cache'] : []),
      ...(push || output ? Object.entries(ANNOTATIONS).flatMap(([key, value]) => ['--annotation', `index:${key}=${value}`, '--annotation', `manifest:${key}=${value}`]) : []),
      ...(push ? ['--output', 'type=image,push=true'] : output ? ['--output', `type=oci,dest=${output}`] : ['--load']),
      context,
    ];
    console.log(`image:build: ${tags.join(', ')} for ${platforms} on the builder ${builder}${push ? ', to be pushed' : ''}, version ${release.version}, the site as ${site === 'worktree' ? 'the working tree holds it' : `${site}, ${release.revision.slice(0, 12)}`}, on Konzilo ${core.described}`);
    const started = Date.now();
    const status = await new Promise((resolve) => spawn('docker', args, { stdio: 'inherit' }).on('close', resolve));
    const seconds = (Date.now() - started) / 1000;
    if (status !== 0) throw new Error(`docker buildx build ended with ${status} after ${seconds.toFixed(0)} s`);
    console.log(`image:build: built ${tags.join(', ')} for ${platforms} in ${seconds.toFixed(0)} s${push ? ', and pushed' : ''}`);
    return { seconds, core, release, tag: tags[0], tags, platforms };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { values } = parseArgs({
    options: {
      platform: { type: 'string', default: HERE },
      tag: { type: 'string', multiple: true, default: [DEFAULT_TAG] },
      version: { type: 'string' },
      output: { type: 'string' },
      push: { type: 'boolean', default: false },
      builder: { type: 'string', default: DEFAULT_BUILDER },
      site: { type: 'string', default: 'HEAD' },
      'core-only': { type: 'boolean', default: false },
      'no-cache': { type: 'boolean', default: false },
    },
  });
  try {
    await buildImage({ ...values, coreOnly: values['core-only'], noCache: values['no-cache'] });
  } catch (error) {
    console.error(`image:build: ${error.message}`);
    process.exit(1);
  }
}

