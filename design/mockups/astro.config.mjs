// Builds the mockups as static pages, one file each, from Konzilo Design's released package.
//
// Which pages a run builds comes from MOCKUP_PAGES (names apart by commas), which scripts/build.mjs sets; without it
// every page is built. A page is a file in pages/, or a content file in ../content/ by its address (src/lib/content.js).
// The design's stylesheets come from fromDesign(), as a Konzilo site takes them, so its checks run here too.
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { fromDesign } from '@kntnt/konzilo-design/konzilo';

const root = fileURLToPath(new URL('.', import.meta.url));
process.env.MOCKUPS_ROOT = root;
const { DESIGN_FILE } = await import('./src/lib/design.js');
const { pageNames } = await import('./src/lib/pages.js');

const wanted = (process.env.MOCKUP_PAGES ?? '').split(',').map((name) => name.trim()).filter(Boolean);
const { own, content } = pageNames();
const known = new Set([...own, ...content]);
const unknown = wanted.filter((name) => !known.has(name));
if (unknown.length) throw new Error(`No mockup page is called ${unknown.join(', ')}. Pages: ${[...known].sort().join(', ')}`);
const chosen = wanted.length ? wanted : [...known];

// The design's stylesheets, in the order fromDesign() gives them: the generated core, the reset and body text,
// konzilo.css and the fonts. A path starting ./ or ../ is from the root, anything else a package's stylesheet.
const { bodyStyles } = await fromDesign(DESIGN_FILE, { root, logos: './public/logos' });
const styles = bodyStyles.map((style) => (style.startsWith('.') ? resolve(root, style) : style));

export default defineConfig({
  root,
  output: 'static',
  build: { format: 'file', inlineStylesheets: 'always', assets: '_astro' },
  cacheDir: process.env.MOCKUP_CACHE_DIR ?? './node_modules/.astro',
  devToolbar: { enabled: false },
  integrations: [{
    name: 'mockup-pages',
    hooks: {
      'astro:config:setup': ({ injectRoute }) => {
        for (const name of chosen) {
          if (own.includes(name)) injectRoute({ pattern: `/${name}`, entrypoint: `./pages/${name}.astro`, prerender: true });
        }
        // Every content file the run builds comes from one route, which lists them by name.
        if (chosen.some((name) => content.includes(name) && !own.includes(name))) {
          process.env.MOCKUP_CONTENT_PAGES = chosen.filter((name) => content.includes(name) && !own.includes(name)).join(',');
          injectRoute({ pattern: '/[page]', entrypoint: './src/routes/content.astro', prerender: true });
        }
      },
    },
  }],
  vite: {
    plugins: [{
      name: 'mockup-styles',
      resolveId: (id) => (id === 'virtual:mockup-styles' ? '\0mockup-styles' : undefined),
      load: (id) => (id === '\0mockup-styles' ? styles.map((style) => `import ${JSON.stringify(style)};`).join('\n') : undefined),
    }],
    build: { assetsInlineLimit: 0 },
    logLevel: 'warn',
  },
});
