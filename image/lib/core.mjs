// Where the image takes Konzilo from, and the check that it is the core the site pins.
//
// The image holds the core twice over: the site's dependency, the package the site pins (a tarball in its
// vendor/), installed from the site's lock; and the core's programs and what builds the editor, from the core's
// Git source at the tag of that package's version, since the package holds only bin/, src/ and the core's demo
// content, not compose/, scripts/, versions.env or the lock its own dependencies are installed from. The build
// stops unless every file of the package is the same file at the tag.

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';

// The core the site pins, from the tag of its version. To try the image on a core not yet released, make this
// { from: 'integration', branch: '<branch>', worktree: '<a worktree of it>' }: the image then takes that
// worktree's committed tip, and says that it is not the core the site pins.
export const CORE_SOURCE = { from: 'pinned' };

export const CORE_REPOSITORY = 'https://github.com/Kntnt/konzilo.git';

// A clone of the core on the building machine, whose tags spare a clone from GitHub; KONZILO_CORE_CLONE names
// another.
const LOCAL_CLONE = process.env.KONZILO_CORE_CLONE ?? join(homedir(), 'Projects/konzilo');

const git = (folder, ...args) => execFileSync('git', ['-C', folder, ...args], { encoding: 'utf8' }).trim();

// What the site's package.json pins the core by: a Git tag (`github:Kntnt/konzilo#v0.4.0`), a file such as a
// packed tarball (`file:vendor/kntnt-konzilo-0.5.0.tgz`), or a version from a registry.
export function pinOf(packageJson) {
  const spec = packageJson.dependencies?.['@kntnt/konzilo'];
  if (!spec) throw new Error('the site\'s package.json does not depend on @kntnt/konzilo');
  const tag = /^(?:github:|git\+https:\/\/github\.com\/|https:\/\/github\.com\/)Kntnt\/konzilo(?:\.git)?#(.+)$/.exec(spec);
  if (tag) return { kind: 'tag', spec, tag: tag[1] };
  if (spec.startsWith('file:')) return { kind: 'file', spec, path: spec.slice('file:'.length) };
  if (/^\d+\.\d+\.\d+/.test(spec)) return { kind: 'version', spec, version: spec };
  throw new Error(`the site pins the core by ${spec}, which the image cannot take`);
}

// The version of a packed core, from its package.json.
function versionInTarball(tarball) {
  const text = execFileSync('tar', ['-xzOf', tarball, 'package/package.json'], { encoding: 'utf8' });
  return JSON.parse(text).version;
}

// Every file of a packed core that differs from the same file in the core's source at `folder`.
export function tarballDiffers(tarball, folder) {
  const unpacked = mkdtempSync(join(tmpdir(), 'konzilo-pack-'));
  try {
    execFileSync('tar', ['-xzf', tarball, '-C', unpacked]);
    const root = join(unpacked, 'package');
    const files = (dir) => readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? files(join(dir, name)) : [join(dir, name)]));
    return files(root).map((path) => relative(root, path)).filter((path) => {
      try {
        return !readFileSync(join(folder, path)).equals(readFileSync(join(root, path)));
      } catch {
        return true;
      }
    });
  } finally {
    execFileSync('rm', ['-rf', unpacked]);
  }
}

// The core's source in a new folder under `into`, ready to be the build context `core`, and what it is:
// { folder, version, commit, described, agrees, note }.
export function takeCore({ site, into, source = CORE_SOURCE }) {
  const packageJson = JSON.parse(readFileSync(join(site, 'package.json'), 'utf8'));
  const pin = pinOf(packageJson);
  const folder = join(into, 'core');
  execFileSync('mkdir', ['-p', folder]);

  if (source.from === 'integration') {
    const commit = git(source.worktree, 'rev-parse', 'HEAD');
    const uncommitted = git(source.worktree, 'status', '--porcelain', '--untracked-files=no');
    execFileSync('sh', ['-c', 'git -C "$1" archive --format=tar "$2" | tar -xf - -C "$3"', 'sh', source.worktree, commit, folder]);
    const { version } = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8'));
    return {
      folder,
      version,
      commit,
      described: `${version}+${source.branch}.${commit.slice(0, 7)}`,
      agrees: false,
      note: `the core is the committed tip of ${source.branch}, ${commit.slice(0, 12)} (${version} and later)${uncommitted ? ', and the worktree\'s uncommitted changes are left out' : ''}; the site pins ${pin.spec}. The two agree once the site pins the release, and CORE_SOURCE in image/lib/core.mjs is { from: 'pinned' }.`,
    };
  }

  if (source.from !== 'pinned') throw new Error(`CORE_SOURCE.from is ${source.from}, neither integration nor pinned`);
  const version = pin.kind === 'file' ? versionInTarball(resolve(site, pin.path)) : pin.kind === 'version' ? pin.version : null;
  const tag = pin.kind === 'tag' ? pin.tag : `v${version}`;
  let commit;
  let from;
  const local = (() => {
    try {
      return git(LOCAL_CLONE, 'rev-parse', '--verify', '--quiet', `${tag}^{commit}`);
    } catch {
      return null;
    }
  })();
  if (local) {
    execFileSync('sh', ['-c', 'git -C "$1" archive --format=tar "$2" | tar -xf - -C "$3"', 'sh', LOCAL_CLONE, tag, folder]);
    commit = local;
    from = `the clone in ${LOCAL_CLONE}`;
  } else {
    execFileSync('git', ['clone', '--quiet', '--depth', '1', '--branch', tag, CORE_REPOSITORY, folder], { stdio: ['ignore', 'ignore', 'inherit'] });
    commit = git(folder, 'rev-parse', 'HEAD');
    execFileSync('rm', ['-rf', join(folder, '.git')]);
    from = CORE_REPOSITORY;
  }
  const tagged = JSON.parse(readFileSync(join(folder, 'package.json'), 'utf8')).version;
  const problems = [];
  if (version !== null && tagged !== version) problems.push(`the tag ${tag} is version ${tagged}, and the site pins ${version}`);
  if (pin.kind === 'tag' && `v${tagged}` !== tag) problems.push(`the tag ${tag} holds version ${tagged}`);
  if (pin.kind === 'file') {
    const differ = tarballDiffers(resolve(site, pin.path), folder);
    if (differ.length > 0) problems.push(`${pin.path} differs from the tag ${tag} in ${differ.slice(0, 10).join(', ')}${differ.length > 10 ? ` and ${differ.length - 10} more` : ''}`);
  }
  if (problems.length > 0) throw new Error(`the core the site pins and the tag the image would take disagree: ${problems.join('; ')}`);
  return { folder, version: tagged, commit, tag, described: tagged, agrees: true, note: `the core is ${tag}, ${commit.slice(0, 12)}, from ${from}, which the site pins by ${pin.spec}${pin.kind === 'file' ? `, every file of which is the same at the tag` : ''}` };
}
