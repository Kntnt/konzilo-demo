// Where things are. Astro bundles these modules before it renders a page, so import.meta.url says nothing about where
// the source is: astro.config.mjs states the root in MOCKUPS_ROOT, and the working directory stands in for it elsewhere.
import { join, resolve } from 'node:path';

export const ROOT = resolve(process.env.MOCKUPS_ROOT ?? process.cwd());
export const DESIGN = resolve(ROOT, '..');
export const CONTENT = join(DESIGN, 'content');
export const IMAGES = join(DESIGN, 'images');
export const LOGOS = join(DESIGN, 'logo');
