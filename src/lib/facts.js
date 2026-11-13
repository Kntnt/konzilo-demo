// A post's facts, the values of its type's own fields, as a case study and a vacancy show them beside or under their
// opening, as the approved design had them: each under its label in the site description, a unit the label gives after
// its last comma ("Solar capacity, MWp") put after the value instead, a number in the page's language, a day as a <time>
// in the core's long form, and a value linked where the template names its page. A field without a value is left out.
import { longDate } from '@kntnt/konzilo/astro/helpers';
import { publicSite } from '@kntnt/konzilo/astro';
import description from '../../site-description.json';

const escapeText = (text) => String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttribute = (text) => escapeText(text).replace(/"/g, '&quot;');

/**
 * The facts of a post, in the order `names` gives, each { label, value }, the value as HTML.
 * @param {{ data: object }} entry The post's entry.
 * @param {string} type The post's type in the site description.
 * @param {string[]} names The fields shown.
 * @param {URL} url The page's address, Astro.url, whose language the values take.
 * @param {Record<string, string>} [links] The address a field's value links to, by the field's name.
 */
export function factsOf(entry, type, names, url, links = {}) {
  const fields = description.types[type].fields;
  const { languageTag } = publicSite(url);
  return names.filter((name) => ![undefined, null, ''].includes(entry.data[name])).map((name) => {
    const field = fields[name];
    const [label, unit] = field.type === 'number' || field.type === 'integer' ? field.label.split(/,\s*(?=[^,]+$)/) : [field.label];
    const value = entry.data[name];
    if (field.type === 'date') {
      const day = new Date(value);
      return { label, value: `<time datetime="${day.toISOString().slice(0, 10)}">${escapeText(longDate(day, url))}</time>` };
    }
    if (field.type === 'number' || field.type === 'integer') {
      return { label, value: escapeText(`${Number(value).toLocaleString(languageTag, { maximumFractionDigits: 1 })}${unit ? ` ${unit}` : ''}`) };
    }
    if (links[name]) return { label, value: `<a href="${escapeAttribute(links[name])}">${escapeText(value)}</a>` };
    return { label, value: escapeText(value) };
  });
}
