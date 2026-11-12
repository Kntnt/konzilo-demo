import { defineConfig } from 'astro/config';
import konzilo from '@kntnt/konzilo/astro';
import { fromDesign } from '@kntnt/konzilo-design/konzilo';
import { searchTexts } from './src/lib/search-texts.js';

// Every page is built for the site's public host, which the build's environment names. A local copy answers at
// Astro's dev server.
process.env.KONZILO_ORIGIN ??= 'http://localhost:4321';

// The component of each presentation the site description declares. All four are one plain stand-in until the
// design's presentations come; give a presentation its own by changing its path.
const POST_LIST_STAND_IN = './src/components/PostList.astro';

export default defineConfig({
  integrations: [konzilo({
    // The design, used where it is (Konzilo Design's docs/spec/konzilo.md): the body styles it generates, with
    // the typefaces in design/fonts/, and the colours the core takes as the site's theme. Its logos are in
    // public/logos/, which `npm run logos` writes from the design file before every build.
    ...await fromDesign('./design/site.design.json'),
    presentations: { cards: POST_LIST_STAND_IN, featured: POST_LIST_STAND_IN, filtered: POST_LIST_STAND_IN, rows: POST_LIST_STAND_IN },
    directives: { form: './src/components/Form.astro' },
    searchPage: './src/components/SearchPage.astro',
    termPage: './src/components/TermPage.astro',
    // The search page's and the search box's words, from design/content/system/search.md.
    texts: { en_GB: { search: searchTexts() } },
  })],
  // Code blocks take their colours from the custom properties konzilo.css gives them.
  markdown: {
    shikiConfig: { theme: 'css-variables' },
  },
  // The dev server shows the pages as the public site does. Astro's dev toolbar would sit over them at the foot
  // of the window, where the consent banner is.
  devToolbar: { enabled: false },
});
