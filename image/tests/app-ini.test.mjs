// Forgejo's app.ini from the settings compose.yaml gives Forgejo.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { iniOf, settingsOf, substitute } from '../runtime/app-ini.mjs';
import { ENVIRONMENT } from '../runtime/programs.mjs';

// The shape of the core's x-forgejo block, as its compose.yaml has it.
const compose = {
  'x-forgejo': {
    environment: {
      FORGEJO__server__ROOT_URL: 'http://localhost:${KONZILO_PORT_GIT}/',
      FORGEJO__server__HTTP_PORT: '3000',
      FORGEJO__security__COOKIE_REMEMBER_NAME: '${KONZILO_SITE}_remember',
      'FORGEJO__service.explore__DISABLE_USERS_PAGE': 'true',
      FORGEJO__cors__ALLOW_DOMAIN: 'http://localhost:${KONZILO_PORT_ADMIN}',
      FORGEJO__webhook__ALLOWED_HOST_LIST: '${KONZILO_WEBHOOK_HOST:-editors}',
    },
  },
};

describe('app.ini', () => {
  test('substitutes as Compose does', () => {
    assert.equal(substitute('a ${A} b', { A: '1' }), 'a 1 b');
    assert.equal(substitute('${A:-x}', {}), 'x');
    assert.equal(substitute('${A:-x}', { A: '' }), 'x');
    assert.equal(substitute('${A-x}', { A: '' }), '');
    assert.equal(substitute('${A-x}', {}), 'x');
    assert.throws(() => substitute('${MISSING}', {}), /nothing sets/);
  });

  test('holds Compose\'s settings for this image\'s ports and name, Forgejo on the loopback, and its user', () => {
    const settings = settingsOf(compose, { environment: ENVIRONMENT, user: 'node' });
    assert.equal(settings.server.ROOT_URL, 'http://localhost:8082/');
    assert.equal(settings.server.HTTP_ADDR, '127.0.0.1');
    assert.equal(settings.security.COOKIE_REMEMBER_NAME, 'ampfield_remember');
    assert.equal(settings['service.explore'].DISABLE_USERS_PAGE, 'true');
    assert.equal(settings.cors.ALLOW_DOMAIN, 'http://localhost:8081');
    assert.equal(settings.webhook.ALLOWED_HOST_LIST, 'loopback');
    assert.equal(settings.DEFAULT.RUN_USER, 'node');
    assert.equal(settings.database.PATH, '/var/lib/gitea/data/gitea.db');
  });

  test('writes sections in order, the default section first and unnamed', () => {
    const text = iniOf({ DEFAULT: { RUN_USER: 'node' }, server: { HTTP_PORT: '3000' } });
    assert.equal(text, 'RUN_USER = node\n\n[server]\nHTTP_PORT = 3000\n');
    assert.throws(() => iniOf({ server: { X: 'a\nb' } }), /line break/);
  });

  test('refuses a compose.yaml without Forgejo\'s block, or with a variable of another form', () => {
    assert.throws(() => settingsOf({}, { environment: {}, user: 'node' }), /x-forgejo/);
    assert.throws(() => settingsOf({ 'x-forgejo': { environment: { GITEA_X: '1' } } }, { environment: {}, user: 'node' }), /FORGEJO__section__KEY/);
  });
});
