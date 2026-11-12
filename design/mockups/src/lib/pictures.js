// Pictures by id. A page names a picture `image:<id>`, as the text does, for design/images/<id>.jpg, or `logo:<name>`
// for a file in design/logo/. What a page writes is a token, `mockup-image:<id>?w=<width>` or `mockup-logo:<name>`,
// which scripts/build.mjs turns into a file beside the built page, made at that width, or into a plain placeholder that
// names the id where the picture has not arrived. So a page never waits for a picture, and a picture is made once.
//
// Widths by place, in CSS pixels at twice the density they are shown at most: wide enough to stay sharp, small enough
// to keep the pages light.
export const WIDTHS = Object.freeze({ behind: 2400, hero: 1600, section: 1400, figure: 1400, card: 900, tab: 1000, portrait: 640, logo: 0 });

// The token for a picture's address as the text writes it: image:<id>, logo:<name>, or a path to a file whose name is
// an id, such as ../images/hero-home.jpg or ../media/hero-home-3f9a1c2b7d.webp. Any other address stays as it is.
export function pictureSrc(src, width = WIDTHS.figure) {
  const address = String(src ?? '');
  let match = /^image:([\w-]+)$/.exec(address);
  if (match) return `mockup-image:${match[1]}?w=${width}`;
  match = /^logo:([\w-]+)$/.exec(address);
  if (match) return `mockup-logo:${match[1]}`;
  if (/^(?:[a-z]+:|\/\/|#)/i.test(address) && !address.startsWith('mockup-')) return address;
  match = /(?:^|\/)(?:images|media)\/([\w-]+?)(?:-[0-9a-f]{10})?\.(?:jpe?g|png|webp|avif)$/i.exec(address);
  if (match) return `mockup-image:${match[1]}?w=${width}`;
  match = /(?:^|\/)logo\/([\w-]+)\.(?:svg|png|webp|jpe?g)$/i.exec(address);
  if (match) return `mockup-logo:${match[1]}`;
  return address;
}

// For a page file: the token of design/images/<id>.jpg at a width, by place or in pixels.
export const picture = (id, width = 'figure') => `mockup-image:${id}?w=${typeof width === 'number' ? width : WIDTHS[width] ?? WIDTHS.figure}`;
export const logo = (name) => `mockup-logo:${name}`;
