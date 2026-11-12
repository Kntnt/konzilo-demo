// The search page's and the search box's words, as design/content/system/search.md gives them, so that the
// file stays the one place they are written: each row of its table "The words" names one of the core's texts,
// `site.search.<name>`, and gives the site's own. A row marked "(The core's own text.)" is left to the core.
// The core refuses a name it has not got; this refuses a file it cannot read.

import { readFileSync } from 'node:fs';

const FILE = new URL('../../design/content/system/search.md', import.meta.url);
const CORES_OWN = ' (The core\'s own text.)';

export function searchTexts() {
  const texts = {};
  for (const line of readFileSync(FILE, 'utf8').split('\n')) {
    const row = /^\| `site\.search\.([A-Za-z]+)` \| (.+) \|$/.exec(line);
    if (!row) continue;
    const [, name, text] = row;
    if (Object.hasOwn(texts, name)) throw new Error(`design/content/system/search.md gives site.search.${name} twice`);
    if (!text.endsWith(CORES_OWN)) texts[name] = text;
  }
  if (Object.keys(texts).length === 0) throw new Error('design/content/system/search.md gives no search texts in its table of words');
  return texts;
}
