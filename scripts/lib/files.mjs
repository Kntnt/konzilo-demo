// Folders as the scripts compare and copy them: every file below a folder by its path from the folder, with
// `/` between its parts, in a fixed order, so that two folders that hold the same bytes give the same digest
// on any machine.

import { createHash } from 'node:crypto';
import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// Every file below `folder`, by its path from it, sorted; none for a folder that is not there.
export function filesIn(folder) {
  if (!existsSync(folder)) return [];
  const walk = (at) => readdirSync(at).flatMap((name) => {
    const path = join(at, name);
    return statSync(path).isDirectory() ? walk(path) : [relative(folder, path).split(sep).join('/')];
  });
  return walk(folder).sort();
}

// One SHA-256 of a folder's paths and bytes.
export function digestOf(folder) {
  const hash = createHash('sha256');
  for (const path of filesIn(folder)) hash.update(`${path}\0`).update(readFileSync(join(folder, path))).update('\0');
  return hash.digest('hex');
}

// Puts a copy of `from` in the place of `to`, leaving out the paths `leaveOut` names: the copy is made beside
// `to` and renamed into place, so that a copy that fails leaves `to` as it was.
export function replaceWithCopy(from, to, { leaveOut = () => false } = {}) {
  const next = `${to}.next`;
  rmSync(next, { recursive: true, force: true });
  cpSync(from, next, { recursive: true, filter: (path) => path === from || !leaveOut(relative(from, path).split(sep).join('/')) });
  rmSync(to, { recursive: true, force: true });
  renameSync(next, to);
}
