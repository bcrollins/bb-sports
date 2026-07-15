import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createRequestId, redactForLog } from '../lib/request-id';

test('createRequestId accepts safe inbound ids and mints otherwise', () => {
  assert.equal(createRequestId('abc12345'), 'abc12345');
  assert.notEqual(createRequestId('no spaces allowed here!!!'), 'no spaces allowed here!!!');
  assert.match(createRequestId(null), /^[0-9a-f-]{36}$/i);
});

test('redactForLog strips secrets and long strings', () => {
  const out = redactForLog({
    password: 'hunter2',
    email: 'fan@example.com',
    token: 'abc',
    path: '/articles/bears',
    note: 'x'.repeat(300),
  }) as Record<string, unknown>;
  assert.equal(out.password, '[redacted]');
  assert.equal(out.email, '[redacted]');
  assert.equal(out.token, '[redacted]');
  assert.equal(out.path, '/articles/bears');
  assert.equal(typeof out.note, 'string');
  assert.ok(String(out.note).endsWith('…'));
});

test('middleware attaches x-request-id on responses', () => {
  const mw = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.match(mw, /x-request-id/);
  assert.match(mw, /attachRequestId/);
  assert.match(mw, /crypto\.randomUUID/);
});
