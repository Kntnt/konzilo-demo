// Small helpers for writing HTML as text and reading the core's hast tree.
import { toHtml } from 'hast-util-to-html';

export const escapeText = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escapeAttribute = (value) => String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Attributes from an object: undefined, null and false are left out, true and '' are written bare.
export const attributes = (values = {}) => Object.entries(values)
  .filter(([, value]) => value !== undefined && value !== null && value !== false)
  .map(([name, value]) => (value === true || value === '' ? ` ${name}` : ` ${name}="${escapeAttribute(value)}"`))
  .join('');

export const tag = (name, values, ...content) => `<${name}${attributes(values)}>${content.flat(Infinity).filter((part) => part !== undefined && part !== null && part !== false).join('')}</${name}>`;
export const voidTag = (name, values) => `<${name}${attributes(values)}>`;

export const isElement = (node, ...names) => node?.type === 'element' && (names.length === 0 || names.includes(node.tagName));
export const isHeading = (node) => isElement(node) && /^h[1-6]$/.test(node.tagName);
export const levelOf = (node) => Number(node.tagName.slice(1));

// The blocks of a body: its elements, without the white space between them.
export const blocksOf = (nodes = []) => nodes.filter((node) => node.type === 'element' || (node.type === 'text' && node.value.trim() !== ''));

// A directive's name, where the node is the core's plain rendering of one.
export const directiveOf = (node) => (isElement(node, 'div') && typeof node.properties?.dataDirective === 'string' ? node.properties.dataDirective : null);

// A directive's attributes, by their names as written: data-max-count is maxCount.
export function attributesOf(node) {
  const found = {};
  for (const [key, value] of Object.entries(node.properties ?? {})) {
    if (!key.startsWith('data') || key === 'dataDirective' || key.length < 5) continue;
    found[key[4].toLowerCase() + key.slice(5)] = Array.isArray(value) ? value.join(' ') : String(value);
  }
  return found;
}

export const outer = (node) => toHtml(node);
export const inner = (node) => toHtml({ type: 'root', children: node.children ?? [] });
export const textOf = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(textOf).join(''));

// Every element in a tree, depth first.
export function* walk(node) {
  if (node.type === 'element') yield node;
  for (const child of node.children ?? []) yield* walk(child);
}
