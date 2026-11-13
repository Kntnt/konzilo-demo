// The sign-in pages' buttons: what they fill in, the code they make, and how they wait when Forgejo has taken a
// code already. The script runs here against a small stand-in for a browser's page, with a clock of the test's.

import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, test } from 'node:test';

import { footerOf } from '../runtime/buttons/footer.mjs';
import { konziloDemoSignIn } from '../runtime/buttons/sign-in.js';
import { PEOPLE } from '../runtime/programs.mjs';

// RFC 6238's own key for SHA-1, "12345678901234567890", in base32.
const KEY = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';
const people = PEOPLE.map((person) => ({ ...person, key: KEY, line: `${person.role} line` }));

// The code the server computes, as the core's src/totp.js does.
function reference(key, at) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const bits = [...key].map((c) => alphabet.indexOf(c).toString(2).padStart(5, '0')).join('');
  const secret = Buffer.from(bits.match(/.{8}/g).map((b) => parseInt(b, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(at / 30000)));
  const digest = createHmac('sha1', secret).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

// A page with just what the script touches.
class Element {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.listeners = {};
    this.dataset = {};
    this.attributes = {};
    this.value = '';
    this.textContent = '';
    this.disabled = false;
  }
  append(...nodes) {
    this.children.push(...nodes);
  }
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  addEventListener(type, listener) {
    (this.listeners[type] ??= []).push(listener);
  }
  dispatchEvent(event) {
    for (const listener of this.listeners[event.type] ?? []) listener(event);
  }
  async click() {
    await Promise.all((this.listeners.click ?? []).map((listener) => listener({ currentTarget: this })));
  }
  get all() {
    return [this, ...this.children.filter((child) => child instanceof Element).flatMap((child) => child.all)];
  }
}

function page(path, { refused = false, serverTime, storage = new Map() } = {}) {
  const form = new Element('form');
  const panels = [];
  form.parentNode = { insertBefore: (box) => panels.push(box) };
  form.prepend = (box) => panels.push(box);
  const fields = { '#user_name': new Element('input'), '#password': new Element('input'), 'input[name="passcode"]': new Element('input') };
  for (const field of Object.values(fields)) field.form = form;
  const store = (map) => ({ getItem: (name) => map.get(name) ?? null, setItem: (name, value) => map.set(name, String(value)), removeItem: (name) => map.delete(name) });
  const clock = { now: serverTime };
  const window = {
    Date,
    Event: class {
      constructor(type) {
        this.type = type;
      }
    },
    crypto: globalThis.crypto,
    setTimeout,
    location: { pathname: path },
    localStorage: store(storage),
    sessionStorage: store(storage.session ??= new Map()),
    fetch: async () => ({ headers: { get: () => new Date(clock.now).toUTCString() } }),
    document: {
      createElement: (tag) => new Element(tag),
      querySelector: (selector) => {
        if (selector === 'form[action*="/user/login"]') return path === '/user/login' ? form : null;
        if (selector === '.flash-error, .ui.negative.message') return refused ? new Element('div') : null;
        return fields[selector] ?? null;
      },
    },
  };
  // The computer's clock is a minute behind Forgejo's, which the script reads from the Date header.
  // What the notice says each time the script waits.
  const waited = [];
  const notice = () => panels.flatMap((panel) => panel.all).find((element) => element.className === 'konzilo-demo-notice')?.textContent ?? '';
  const options = {
    now: () => clock.now - 60_000,
    wait: async (ms) => {
      waited.push(notice());
      clock.now += ms;
    },
  };
  konziloDemoSignIn(window, people, options);
  const buttons = () => panels.flatMap((panel) => panel.all).filter((element) => element.tag === 'button');
  return { form, fields, panels, buttons, notice, waited, clock, storage };
}

// A moment some seconds into a half minute, on a whole second, as a Date header has it.
const T = Date.UTC(2026, 10, 13, 9, 0, 33);

describe('the sign-in buttons', () => {
  test('on the sign-in page, one button per person fills in the user and the password, and the page lists each with the password', async () => {
    const { buttons, fields, panels } = page('/user/login', { serverTime: T });
    assert.deepEqual(buttons().map((button) => button.textContent), ['Admin: Ada Lindholm', 'Editor: Edvin Hale', 'Reviewer: Rosa Quinlan']);
    await buttons()[1].click();
    assert.equal(fields['#user_name'].value, 'edvin');
    assert.equal(fields['#password'].value, 'ampfield-editor');
    const text = panels[0].all.map((element) => element.textContent).join(' ');
    for (const person of PEOPLE) assert.ok(text.includes(`password ${person.password}`));
  });

  test('on the second-factor page, the chosen person\'s button fills in the code for Forgejo\'s time, not the computer\'s', async () => {
    const storage = new Map();
    const signIn = page('/user/login', { serverTime: T, storage });
    await signIn.buttons()[0].click();
    const { buttons, fields } = page('/user/two_factor', { serverTime: T, storage });
    assert.deepEqual(buttons().map((button) => button.textContent), ["Ada Lindholm's code"]);
    await buttons()[0].click();
    assert.equal(fields['input[name="passcode"]'].value, reference(KEY, T));
  });

  test('makes RFC 6238\'s own code', async () => {
    const { buttons, fields } = page('/user/two_factor', { serverTime: 59_000 });
    await buttons()[0].click();
    assert.equal(fields['input[name="passcode"]'].value, '287082');
  });

  test('never fills in a code it has sent: it says how long the next one is, waits for it, and fills that in', async () => {
    const storage = new Map();
    const first = page('/user/two_factor', { serverTime: T, storage });
    await first.buttons()[0].click();
    first.form.dispatchEvent({ type: 'submit' });
    const again = page('/user/two_factor', { serverTime: T + 2000, storage });
    await again.buttons()[0].click();
    const next = Math.ceil((T + 1) / 30000) * 30000;
    assert.equal(again.fields['input[name="passcode"]'].value, reference(KEY, next));
    assert.notEqual(again.fields['input[name="passcode"]'].value, reference(KEY, T));
    assert.ok(again.clock.now >= next, 'it waited for the next half minute');
    assert.ok(again.waited.length > 1, 'it counted down');
    assert.match(again.waited[0], /takes each code once.*The next one comes in \d+ seconds\./);
    assert.match(again.waited.at(-1), /The next one comes in 1 second\./);
    assert.equal(again.notice(), '', 'and says nothing once it has filled it in');
  });

  test('says so when Forgejo refused the code it filled in, as when the same person signed in elsewhere within the half minute', async () => {
    const storage = new Map();
    const first = page('/user/two_factor', { serverTime: T, storage });
    await first.buttons()[0].click();
    first.form.dispatchEvent({ type: 'submit' });
    const refused = page('/user/two_factor', { serverTime: T + 1000, storage, refused: true });
    assert.match(refused.notice(), /Forgejo refused that code\. It takes each code once/);
  });

  test('writes a template Forgejo takes as it is: no {{, nothing that closes the script early, plain ASCII', () => {
    const text = footerOf(people);
    assert.ok(!text.includes('{{'));
    assert.equal(text.indexOf('</script>'), text.length - '</script>\n'.length);
    assert.match(text, /^<script>\(function konziloDemoSignIn\(/);
    assert.ok(/^[\x09\x0a\x20-\x7e]*$/.test(text));
    assert.throws(() => footerOf([{ ...people[0], password: 'a{{b' }]), /\{\{/);
  });
});
