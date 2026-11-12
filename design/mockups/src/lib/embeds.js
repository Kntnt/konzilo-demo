// Embeds as the Konzilo core draws them before a visitor has consented: a paragraph that holds nothing but the address
// of a video becomes the core's panel (Konzilo's src/astro/embeds.js, embedElement()), a figure with the link to the
// address and the player in a <template>, and the consent client has made it the placeholder (src/consent/client.js,
// embedPanels()): the sentence that the script has not run taken away, and the question, the sentence on what the
// service may store and the button put before the link. konzilo.css draws it.
//
// The words are the core's, as consentView() in Konzilo's src/consent/markup.js gives them for a registry that
// registryFile() (src/format/consent.js) makes for a site with no statistics and YouTube as its one embed service, with
// the consent texts at the core's defaults (src/catalogues/en.json, site.settings.consent.placeholder*): the question
// and the button from those texts, the sentence the core's own (site.consent.placeholder.transferred) from YouTube's
// facts in src/format/services.json, and the link to the cookie policy that consentMarkup() adds to it. The address
// forms and the player are the rule data's (src/format/rules.json, embeds.services.youtube). Only YouTube is here, the
// one service the site's posts embed; any other address stays the paragraph it is.

// YouTube's address forms, each with its player, as the rule data has them.
const YOUTUBE = [
  { pattern: /^https:\/\/(?:www\.|m\.)?youtube\.com\/watch\?v=(?<id>[\w-]{11})$/, player: 'https://www.youtube-nocookie.com/embed/{id}' },
  { pattern: /^https:\/\/(?:www\.|m\.)?youtube\.com\/watch\?v=(?<id>[\w-]{11})&t=(?<start>\d+)s?$/, player: 'https://www.youtube-nocookie.com/embed/{id}?start={start}' },
  { pattern: /^https:\/\/youtu\.be\/(?<id>[\w-]{11})(?:\?si=[\w-]+)?$/, player: 'https://www.youtube-nocookie.com/embed/{id}' },
  { pattern: /^https:\/\/youtu\.be\/(?<id>[\w-]{11})\?(?:si=[\w-]+&)?t=(?<start>\d+)s?$/, player: 'https://www.youtube-nocookie.com/embed/{id}?start={start}' },
  { pattern: /^https:\/\/(?:www\.|m\.)?youtube\.com\/(?:shorts|live|embed)\/(?<id>[\w-]{11})(?:\?si=[\w-]+)?$/, player: 'https://www.youtube-nocookie.com/embed/{id}' },
  { pattern: /^https:\/\/(?:www\.|m\.)?youtube\.com\/playlist\?list=(?<list>[\w-]+)$/, player: 'https://www.youtube-nocookie.com/embed/videoseries?list={list}' },
];
const SERVICES = {
  youtube: {
    name: 'YouTube',
    forms: YOUTUBE,
    ratio: '16 / 9',
    allow: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    question: 'Allow YouTube to play this content?',
    storage: 'YouTube may store data in your browser, and Google Ireland Limited (Ireland) receives data about your visit, which may be processed outside the EU and EEA.',
    button: 'Allow and play',
  },
};
const COOKIE_POLICY = { title: 'Cookie policy', href: '/cookie-policy/' };

const element = (tagName, properties, children = []) => ({ type: 'element', tagName, properties, children });
const text = (value) => ({ type: 'text', value });

// The service and player of an address, or null.
function embedOf(address) {
  for (const [id, service] of Object.entries(SERVICES)) {
    for (const { pattern, player } of service.forms) {
      const found = pattern.exec(address);
      if (found) return { id, service, player: player.replace(/\{(\w+)\}/g, (_, name) => found.groups[name]) };
    }
  }
  return null;
}

// The address a paragraph holds, when it holds nothing but a link whose text is its own address (as the core's
// loneAddress()).
function loneAddress(paragraph) {
  const parts = paragraph.children.filter((node) => !(node.type === 'text' && node.value.trim() === ''));
  const [link, ...rest] = parts;
  if (rest.length > 0 || link?.type !== 'element' || link.tagName !== 'a') return null;
  if (Object.keys(link.properties).join() !== 'href') return null;
  const [only, ...more] = link.children;
  return more.length === 0 && only?.type === 'text' && only.value === link.properties.href ? only.value : null;
}

// The panel for a paragraph, as the placeholder the client makes of it, or null.
export function embedPanel(paragraph) {
  const address = loneAddress(paragraph);
  const embed = address && embedOf(address);
  if (!embed) return null;
  const { id, service, player } = embed;
  const iframe = element('iframe', {
    src: player, title: service.name, allow: service.allow, allowFullScreen: true,
    referrerPolicy: 'strict-origin-when-cross-origin', style: `display: block; width: 100%; aspect-ratio: ${service.ratio}; border: 0`,
  });
  const template = element('template', {});
  template.content = { type: 'root', children: [iframe] };
  return element('figure', { className: ['konzilo-embed'], dataEmbed: id }, [
    element('p', { className: ['konzilo-embed-question'] }, [text(service.question)]),
    element('p', { className: ['konzilo-embed-storage'] }, [
      text(`${service.storage} `),
      element('a', { href: COOKIE_POLICY.href, dataKonziloConsentPolicy: 'cookie-policy' }, [text(COOKIE_POLICY.title)]),
    ]),
    element('button', { type: 'button', className: ['konzilo-embed-allow'] }, [text(service.button)]),
    element('a', { href: address }, [text(address)]),
    template,
  ]);
}

// Every such paragraph in a tree made its panel, in place.
export function embedPanels(node) {
  if (!Array.isArray(node.children)) return node;
  node.children = node.children.map((child) => (child.type === 'element' && child.tagName === 'p' ? embedPanel(child) ?? child : embedPanels(child)));
  return node;
}
