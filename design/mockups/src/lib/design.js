// The design file the mockups are built with: design/site.design.json, or, until it exists, Konzilo Design's own
// example, copied to src/fallback.design.json, so that a build never waits for it.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './paths.js';

const own = join(ROOT, '..', 'site.design.json');
export const DESIGN_FILE = existsSync(own) ? own : join(ROOT, 'src', 'fallback.design.json');
export const USING_FALLBACK = !existsSync(own);
export const design = JSON.parse(readFileSync(DESIGN_FILE, 'utf8'));
if (USING_FALLBACK) console.warn('mockups: design/site.design.json is missing, so the example design stands in for it.');
