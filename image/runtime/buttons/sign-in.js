// The demo's buttons on Forgejo's sign-in and second-factor pages. footer.mjs writes this function's source into
// Forgejo's own extension template, custom/footer, which Forgejo renders at the foot of every page; the core
// knows nothing of it. A button fills in a person's details, and on the second-factor page their current code,
// and does nothing more: the visitor sends the form with its own button.
//
// The code is made in the browser from the person's key, at Forgejo's own time, read from the Date header of its
// answers, so that a computer whose clock is off still gets a code Forgejo takes. Forgejo takes each code once:
// a code this browser has sent is never filled in again, and a button pressed while the person's current code is
// one of those waits for the next, saying how long; a code that Forgejo refused, as when the same person signed in
// elsewhere within the same half minute, counts as sent.
//
// The function must hold all it uses, since only its source is written into the page.

export function konziloDemoSignIn(window, people, { period = 30, now = () => window.Date.now(), wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms)) } = {}) {
  const { document } = window;
  const CHOSEN = 'konzilo-demo-person';
  const SENT = 'konzilo-demo-sent';
  const SUBMITTED = 'konzilo-demo-submitted';
  const periodMs = period * 1000;

  const read = (storage, name, fallback) => {
    try {
      return JSON.parse(storage.getItem(name)) ?? fallback;
    } catch {
      return fallback;
    }
  };
  const write = (storage, name, value) => {
    try {
      storage.setItem(name, JSON.stringify(value));
    } catch {
      // A browser that keeps nothing still gets its codes; it only cannot tell one it has sent.
    }
  };

  // A time-based one-time code (RFC 6238: HMAC-SHA-1, six digits) for the period `step`, from a key in base32.
  async function codeAt(key, step) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const bits = [...key.toUpperCase().replace(/=+$/, '')].map((character) => alphabet.indexOf(character).toString(2).padStart(5, '0')).join('');
    const bytes = new Uint8Array((bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
    const hmac = await window.crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const counter = new DataView(new ArrayBuffer(8));
    counter.setUint32(0, Math.floor(step / 2 ** 32));
    counter.setUint32(4, step % 2 ** 32);
    const mac = new Uint8Array(await window.crypto.subtle.sign('HMAC', hmac, counter.buffer));
    const at = mac[mac.length - 1] & 15;
    const value = (((mac[at] & 127) << 24) | (mac[at + 1] << 16) | (mac[at + 2] << 8) | mac[at + 3]) % 1000000;
    return String(value).padStart(6, '0');
  }

  // How far Forgejo's clock is from this computer's, in milliseconds.
  let skew = null;
  async function skewOf() {
    if (skew !== null) return skew;
    try {
      const answer = await window.fetch('/api/healthz', { cache: 'no-store' });
      const at = Date.parse(answer.headers.get('date'));
      skew = Number.isNaN(at) ? 0 : at + 500 - now();
    } catch {
      skew = 0;
    }
    return skew;
  }

  const sent = () => read(window.localStorage, SENT, {});
  const markSent = (user, code) => {
    const all = sent();
    all[user] = [...new Set([...(all[user] ?? []), code])].slice(-4);
    write(window.localStorage, SENT, all);
  };

  // The code to fill in for `person`: the current one, unless it has been sent, and then the next one, after
  // saying how long it waits.
  async function codeFor(person, tell) {
    const offset = await skewOf();
    const step = Math.floor((now() + offset) / periodMs);
    const current = await codeAt(person.key, step);
    if (!(sent()[person.user] ?? []).includes(current)) return current;
    for (;;) {
      const left = Math.ceil(((step + 1) * periodMs - (now() + offset)) / 1000);
      if (left <= 0) break;
      tell(`Forgejo takes each code once, and ${person.name}'s code for this half minute has been sent. The next one comes in ${left} second${left === 1 ? '' : 's'}.`);
      await wait(Math.min(1000, left * 1000));
    }
    tell('');
    return codeAt(person.key, step + 1);
  }

  const fill = (field, value) => {
    if (!field) return;
    field.value = value;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
    field.dispatchEvent(new window.Event('change', { bubbles: true }));
  };

  const element = (name, properties = {}, children = []) => {
    const made = document.createElement(name);
    Object.assign(made, properties);
    for (const child of children) made.append(child);
    return made;
  };

  // Above the form, in its box; or, where the form is the box's only content, at the form's top (`inside`).
  function panel(form, lead, buttons, extra = [], { inside = false } = {}) {
    const box = element('div', { id: 'konzilo-demo-people', className: 'ui segment' });
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', 'Konzilo Demo');
    box.append(element('p', {}, [element('strong', { textContent: 'Konzilo Demo. ' }), lead]));
    box.append(element('div', { className: 'konzilo-demo-buttons' }, buttons));
    for (const one of extra) box.append(one);
    if (inside) form.prepend(box);
    else form.parentNode.insertBefore(box, form);
    return box;
  }

  const button = (person, text, onClick) => {
    const made = element('button', { type: 'button', className: 'ui basic button', textContent: text });
    made.dataset.person = person.user;
    made.addEventListener('click', onClick);
    return made;
  };

  const path = window.location.pathname.replace(/\/+$/, '');
  const chosen = () => people.find((person) => person.user === read(window.sessionStorage, CHOSEN, null));

  if (path === '/user/login') {
    const form = document.querySelector('form[action*="/user/login"]') ?? document.querySelector('#user_name')?.form;
    if (!form) return;
    const list = element('ul', { className: 'konzilo-demo-list' }, people.map((person) => element('li', {
      textContent: `${person.role}, ${person.name}: user ${person.user}, password ${person.password}. ${person.line}`,
    })));
    panel(form, 'Choose who to sign in as. The button fills in the form, and you send it with Sign in.', people.map((person) => button(person, `${person.role}: ${person.name}`, () => {
      write(window.sessionStorage, CHOSEN, person.user);
      fill(document.querySelector('#user_name'), person.user);
      fill(document.querySelector('#password'), person.password);
    })), [list]);
    return;
  }

  if (path === '/user/two_factor') {
    const field = document.querySelector('input[name="passcode"]');
    const form = field?.form;
    if (!form) return;
    const notice = element('p', { className: 'konzilo-demo-notice' });
    notice.setAttribute('aria-live', 'polite');
    const tell = (text) => {
      notice.textContent = text;
    };
    const one = chosen();
    const shown = one ? [one] : people;
    let filled = null;
    panel(form, 'The button fills in the current code from the person\'s authenticator, and you send it with Verify.', shown.map((person) => button(person, `${person.name}'s code`, async (event) => {
      const pressed = event.currentTarget;
      pressed.disabled = true;
      try {
        const code = await codeFor(person, tell);
        filled = { user: person.user, code };
        fill(field, code);
      } finally {
        pressed.disabled = false;
      }
    })), [notice], { inside: true });
    form.addEventListener('submit', () => {
      if (filled && field.value === filled.code) {
        markSent(filled.user, filled.code);
        write(window.sessionStorage, SUBMITTED, filled);
      }
    });
    // Forgejo answers a refused code with this page again and its own message.
    const submitted = read(window.sessionStorage, SUBMITTED, null);
    window.sessionStorage.removeItem(SUBMITTED);
    if (submitted && document.querySelector('.flash-error, .ui.negative.message')) {
      const person = people.find((candidate) => candidate.user === submitted.user);
      if (person) tell(`Forgejo refused that code. It takes each code once, so if ${person.name} signed in elsewhere within this half minute, press the button for the next one, which it waits for.`);
    }
  }
}
