// What a visitor reads in the terminal: plain ASCII, short lines, and all that is needed to begin.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ENVIRONMENT, PEOPLE, PORTS, PROGRAMS, START } from '../runtime/programs.mjs';
import { bannerLines, plain, readyLines, startingLine } from '../runtime/terminal.mjs';

const release = { version: 'v1.2.3', created: '2026-11-13T08:15:00Z', core: '0.5.0' };
const ascii = (line) => /^[\x20-\x7e]*$/.test(line);

describe('the terminal', () => {
  test('plain() leaves printable ASCII alone and makes everything else plain', () => {
    assert.equal(plain('Ready: http://localhost:8080/ (1.5 s)'), 'Ready: http://localhost:8080/ (1.5 s)');
    assert.equal(plain('\x1b[1;31mred\x1b[0m and \x1b]0;title\x07done'), 'red and done');
    assert.equal(plain('Caddy says 🚀 and Måns says hej\r\n\tok'), 'Caddy says ? and M?ns says hej\n  ok');
  });

  test('every line from the first to the addresses is plain ASCII, no wider than 80 columns', () => {
    const lines = [
      ...bannerLines(release),
      ...START.map((stage) => startingLine(stage.map((name) => PROGRAMS[name].label))),
      ...readyLines({ seconds: 3.62, ports: PORTS, people: PEOPLE, release }),
    ];
    for (const line of lines) {
      assert.ok(ascii(line), `plain ASCII: ${JSON.stringify(line)}`);
      assert.ok(line.length <= 80, `at most 80 columns: ${JSON.stringify(line)}`);
    }
  });

  test('names the version and the day it was built, and how to get the newest', () => {
    assert.deepEqual(bannerLines(release), ['Konzilo Demo v1.2.3, built 2026-11-13, on Konzilo 0.5.0.']);
    const text = readyLines({ seconds: 3.62, ports: PORTS, people: PEOPLE, release }).join('\n');
    assert.match(text, /This copy was built on 2026-11-13/);
    assert.match(text, /docker pull ghcr\.io\/kntnt\/konzilo-demo/);
  });

  test('gives the four addresses, the time it took, and each person to sign in as', () => {
    const text = readyLines({ seconds: 3.62, ports: PORTS, people: PEOPLE, release }).join('\n');
    assert.match(text, /Ready in 3\.6 seconds/);
    for (const port of [8080, 8081, 8082, 8083]) assert.match(text, new RegExp(`http://localhost:${port}\\b`));
    for (const person of PEOPLE) {
      assert.match(text, new RegExp(`${person.role} +${person.name} +user ${person.user} +password ${person.password}`));
    }
    assert.match(text, /Ctrl\+C/);
  });

  test('says what starts in a list a visitor can read', () => {
    assert.equal(startingLine(['Forgejo']), 'Starting Forgejo ...');
    assert.equal(startingLine(['a', 'b', 'c']), 'Starting a, b and c ...');
  });

  test('the three people are one in each role, each with a name that begins as its role does', () => {
    assert.deepEqual(PEOPLE.map((person) => person.role), ['Admin', 'Editor', 'Reviewer']);
    assert.deepEqual(PEOPLE.map((person) => person.team), ['admins', 'editors', 'reviewers']);
    for (const person of PEOPLE) {
      assert.equal(person.name[0], person.role[0]);
      assert.match(person.user, /^[a-z]+$/);
      assert.ok(person.password.length >= 8, 'Forgejo takes no password shorter than eight characters');
    }
    // As the core's seed reads them (Kntnt/konzilo#71): name:role, the Admin also KONZILO_ACCOUNT.
    assert.equal(ENVIRONMENT.KONZILO_PEOPLE, 'ada:admin,edvin:editor,rosa:reviewer');
    assert.equal(ENVIRONMENT.KONZILO_ACCOUNT, 'ada');
  });
});
