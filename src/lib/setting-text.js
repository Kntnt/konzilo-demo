// A setting's text as HTML, for a part that takes HTML, such as Konzilo Design's SmallPrint: its words escaped, each
// link written in it as Markdown, [words](address), drawn as a link, and, with `addresses`, an e-mail address standing
// alone linked to it, as GFM links one in body text.

const escape = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;
const LINK_OR_ADDRESS = /\[([^\]]+)\]\(([^)\s]+)\)|([A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g;

/**
 * @param {string} text The setting's text.
 * @param {{ addresses?: boolean }} [options]
 */
export function settingHtml(text, { addresses = false } = {}) {
  return escape(text).replace(addresses ? LINK_OR_ADDRESS : LINK, (_, label, href, address) => (typeof address === 'string' ? `<a href="mailto:${address}">${address}</a>` : `<a href="${href}">${label}</a>`));
}
