// Writes the demo's buttons into Forgejo's own extension template, custom/footer.tmpl, after the seed has made
// the people and kept their keys: each person's name, role, password and key, and the script of sign-in.js.
//
//   node footer.mjs <footer.tmpl to write>

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

import { ADMIN, PEOPLE, PORTS, origin } from '../programs.mjs';
import { konziloDemoSignIn } from './sign-in.js';

// Where the seed keeps a person's second-factor key (Kntnt/konzilo#71): KONZILO_ACCOUNT's in
// /state/account-totp, and everyone else's in /state/people/<name>-totp.
export function keyFileOf(person, { state = '/state', account = ADMIN.user } = {}) {
  if (person.user === account) return `${state}/account-totp`;
  const own = `${state}/people/${person.user}-totp`;
  if (existsSync(own)) return own;
  throw new Error(`no second-factor key for ${person.user} in ${state}`);
}

// What a line on the sign-in page says the person does.
const lineOf = (person) => (person.role === 'Reviewer'
  ? `Reads the live preview only, and signs in at ${origin(PORTS.preview)}.`
  : `${person.does.charAt(0).toUpperCase()}${person.does.slice(1)}.`);

export function footerOf(people) {
  const given = people.map(({ role, name, user, password, key, does }) => ({ role, name, user, password, key, line: lineOf({ role, does }) }));
  // Inside a <script>, nothing may close it, and Forgejo reads the template for its own {{ }} first.
  const data = JSON.stringify(given).replace(/</g, '\\u003c');
  const text = `<script>(${konziloDemoSignIn.toString()})(window, ${data});</script>\n`;
  if (text.includes('{{')) throw new Error('the buttons\' script holds "{{", which Forgejo would read as its own');
  if (/[^\x09\x0a\x20-\x7e]/.test(text)) throw new Error('the buttons\' script holds a character outside ASCII');
  return text;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = process.argv[2];
  const people = PEOPLE.map((person) => ({ ...person, key: readFileSync(keyFileOf(person), 'utf8').trim() }));
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, footerOf(people));
  console.log(`footer.mjs: the buttons for ${people.map((person) => person.user).join(', ')} in ${out}`);
}
