// Ties each master in a content folder to the picture it was made from, and that picture to its entry in
// design/images/credits.json. A master carries no metadata, but its name holds the first ten hexadecimal digits
// of its original's SHA-256 (`<stem>-<hash>.webp`, content-format.md, Masters), so hashing every picture of the
// design finds it. A logo of design/logo/ is the demo's own drawing and has no entry. A master made from another
// master, as Compose's seed makes one, ties to nothing.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { filesIn } from './files.mjs';
import { ROOT } from './intake.mjs';

const IMAGES = join(ROOT, 'design/images');
const LOGOS = join(ROOT, 'design/logo');

const hashOf = (path) => createHash('sha256').update(readFileSync(path)).digest('hex').slice(0, 10);

// Each master below `folder`/media as { master, original, credit }: `original` the picture's path from the
// repository's root, or null; `credit` its entry in credits.json, or null for a logo or a master tied to nothing.
export function creditsOfMasters(folder) {
  const credits = JSON.parse(readFileSync(join(IMAGES, 'credits.json'), 'utf8'));
  const byHash = new Map();
  for (const credit of credits) byHash.set(hashOf(join(IMAGES, credit.file)), { original: `design/images/${credit.file}`, credit });
  for (const path of filesIn(LOGOS)) byHash.set(hashOf(join(LOGOS, path)), { original: `design/logo/${path}`, credit: null });
  return filesIn(join(folder, 'media')).map((master) => {
    const hash = /-([0-9a-f]{10})\.[a-z]+$/.exec(master)?.[1];
    const found = byHash.get(hash) ?? { original: null, credit: null };
    return { master: `media/${master}`, ...found };
  });
}
