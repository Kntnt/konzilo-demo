// A form as the Konzilo core writes it (its FormView.astro, as Konzilo Design's test/fixtures/konzilo-page.html holds
// it), from the site description's `forms`, which design/content/site.json gives. konzilo.css draws it in Form's look.
// The outcomes stand hidden, as the core sends them; the button says Send, the core's word.
import { attributes, escapeAttribute, escapeText, tag } from './html.js';

// A label's words, with a link written as Markdown, [privacy policy](/privacy-policy/), drawn as a link. The core's
// labels are plain text (design/gaps.md); the mockups show what an acceptance line should become.
const words = (text) => escapeText(text).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${escapeAttribute(href)}">${label}</a>`);

const required = ' <span class="konzilo-form-required">(required)</span>';
const MAX = { text: 200, email: 254, tel: 50, textarea: 5000, url: 2000, number: undefined };
const TEL = '\\+?[0-9 \\(\\)\\.\\/\\-]*[0-9][0-9 \\(\\)\\.\\/\\-]*';

function field(form, spec) {
  const id = `${form}-${spec.name}`;
  const kind = spec.kind ?? 'text';
  const help = spec.help ? `<p class="konzilo-form-help" id="${id}-help">${escapeText(spec.help)}</p>` : '';
  const problem = `<p class="konzilo-form-problem" id="${id}-problem" hidden></p>`;
  const describedBy = spec.help ? `${id}-help` : undefined;
  const mark = spec.required ? required : '';
  const label = `<label for="${id}">${escapeText(spec.label)}${mark}</label>`;
  const options = (spec.options ?? []).map((option) => (typeof option === 'string' ? option : option.label ?? option.value));
  if (kind === 'select') {
    const choices = [`<option value="">Choose…</option>`, ...options.map((option) => `<option value="${escapeText(option)}">${escapeText(option)}</option>`)].join('');
    return tag('div', { class: 'konzilo-form-field konzilo-form-select' }, label, `<select${attributes({ id, name: spec.name, required: !!spec.required, 'aria-describedby': describedBy })}>${choices}</select>`, help, problem);
  }
  if (kind === 'radio' || kind === 'checkboxes') {
    const type = kind === 'radio' ? 'radio' : 'checkbox';
    const choices = options.map((option, index) => `<div class="konzilo-form-choice"><input${attributes({ type, id: `${id}-${index + 1}`, name: spec.name, value: option, required: kind === 'radio' && !!spec.required })}><label for="${id}-${index + 1}">${escapeText(option)}</label></div>`).join('');
    return tag('fieldset', { class: `konzilo-form-field konzilo-form-${kind}`, id, role: kind === 'radio' ? 'radiogroup' : undefined, 'aria-required': kind === 'radio' && spec.required ? 'true' : undefined, 'aria-describedby': describedBy }, `<legend>${escapeText(spec.label)}${mark}</legend>`, help, choices, problem);
  }
  if (kind === 'checkbox' || kind === 'acceptance') {
    const must = kind === 'acceptance' || !!spec.required;
    return tag('div', { class: `konzilo-form-field konzilo-form-${kind}` }, `<input${attributes({ type: 'checkbox', id, name: spec.name, required: must, 'aria-describedby': describedBy })}>`, `<label for="${id}">${words(spec.label)}${must ? required : ''}</label>`, help, problem);
  }
  if (kind === 'textarea') {
    return tag('div', { class: 'konzilo-form-field konzilo-form-textarea' }, label, `<textarea${attributes({ id, name: spec.name, required: !!spec.required, maxlength: spec.maxLength ?? MAX.textarea, 'aria-describedby': describedBy })}></textarea>`, help, problem);
  }
  const input = attributes({
    type: kind, id, name: spec.name, required: !!spec.required, maxlength: spec.maxLength ?? MAX[kind] ?? 200,
    pattern: kind === 'tel' ? TEL : undefined, autocomplete: kind === 'email' ? 'email' : kind === 'tel' ? 'tel' : undefined, 'aria-describedby': describedBy,
  });
  return tag('div', { class: `konzilo-form-field konzilo-form-${kind}` }, label, `<input${input}>`, help, problem);
}

// The form `name` of the site description, for a page at `page`; null for a form it does not declare.
export function coreForm(name, forms, { page = '/', email = 'hello@ampfield.example' } = {}) {
  const spec = forms?.[name];
  if (!spec) return null;
  const id = `konzilo-form-${name}`;
  const outcome = (kind, text) => `<div class="konzilo-form-outcome konzilo-form-${kind}" id="${id}-${kind}" tabindex="-1" hidden><p>${text}</p></div>`;
  const write = `write to us at <a href="mailto:${email}">${email}</a>`;
  return tag('form', { class: 'konzilo-form', id, method: 'post', action: `/_konzilo/forms/${name}`, 'aria-label': spec.label, 'data-konzilo-form': '{}' },
    outcome('sent', escapeText(spec.confirmation ?? 'Thank you.')),
    outcome('invalid', 'Your message was not sent. Check the fields and send it again.'),
    outcome('too-many', 'Your message was not sent, since many messages have come from here just now. Try again later.'),
    outcome('refused', `Your message could not be sent from here. Reload the page and try again, or ${write}.`),
    outcome('unavailable', `Your message could not be sent just now. Try again later, or ${write}.`),
    tag('div', { class: 'konzilo-form-fields' },
      (spec.fields ?? []).map((spec) => field(id, spec)),
      `<div class="konzilo-form-trap" aria-hidden="true"><label for="${id}-website">Leave this field empty</label><input type="text" id="${id}-website" name="_website" tabindex="-1" autocomplete="off"></div>`,
      `<input type="hidden" name="_page" value="${page}">`,
      '<button type="submit" class="konzilo-form-send">Send</button>'));
}
