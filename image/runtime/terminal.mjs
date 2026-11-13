// What a visitor reads in the terminal the image was started from: bash, zsh, PowerShell or cmd alike. So it is
// plain ASCII, with no colour and no other escape sequence, and its lines are short enough for a narrow window.

// Text as a terminal shows it everywhere: escape sequences gone, tabs as spaces, and every character outside
// printable ASCII as a question mark.
export function plain(text) {
  return String(text)
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/\x1b[\]P^_][^\x07\x1b]*(\x07|\x1b\\)?/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/[^\n\x20-\x7e]/gu, '?');
}

// The image's version and the day it was built, so that an old copy is seen for what it is.
export function bannerLines(release) {
  const day = release.created ? release.created.slice(0, 10) : 'an unknown day';
  return [`Konzilo Demo ${release.version ?? 'of unknown version'}, built ${day}, on Konzilo ${release.core ?? '(unknown)'}.`];
}

const listed = (labels) => (labels.length < 2 ? labels.join('') : `${labels.slice(0, -1).join(', ')} and ${labels.at(-1)}`);

export function startingLine(labels) {
  const text = listed(labels);
  return `Starting ${text} ...`;
}

const column = (text, width) => text.padEnd(width);

// What the visitor needs once the site is ready: where each part is, who to sign in as, and how to stop.
export function readyLines({ seconds, ports, people, release, image = 'ghcr.io/kntnt/konzilo-demo' }) {
  const at = (port) => `http://localhost:${port}`;
  const nameWidth = Math.max(...people.map((person) => person.name.length));
  const userWidth = Math.max(...people.map((person) => person.user.length));
  const roleWidth = Math.max(...people.map((person) => person.role.length));
  const day = release.created ? release.created.slice(0, 10) : null;
  return [
    '',
    `Ready in ${seconds.toFixed(1)} seconds. Open these in your browser:`,
    '',
    `  The website        ${at(ports.site)}`,
    `  The editor         ${at(ports.admin)}`,
    `  The live preview   ${at(ports.preview)}`,
    `  Sign-in (Forgejo)  ${at(ports.git)}  (the editor takes you there)`,
    '',
    'Sign in to the editor with Forgejo. Its sign-in page has a button for each',
    "of the site's three people, which fills in the form for you to send:",
    '',
    ...people.map((person) => `  ${column(person.role, roleWidth)}  ${column(person.name, nameWidth)}  user ${column(person.user, userWidth)}  password ${person.password}`),
    '',
    `A Reviewer reads the live preview only, and signs in at ${at(ports.preview)}.`,
    'Whatever you change is gone when this stops. Press Ctrl+C to stop.',
    ...(day ? [`This copy was built on ${day}. For the newest, pull the image again first:`, `  docker pull ${image}`] : []),
    '',
  ];
}
