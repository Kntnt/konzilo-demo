// The mockup pages: a file in pages/ by its name, and every content file by the name of its address. A page file
// with the same name as a content file takes its place.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.js';
import { posts } from './content.js';

export function pageNames() {
  const folder = join(ROOT, 'pages');
  const own = existsSync(folder) ? readdirSync(folder).filter((file) => file.endsWith('.astro')).map((file) => file.slice(0, -'.astro'.length)) : [];
  const content = [...new Set(posts().map((post) => post.name))];
  return { own, content };
}
