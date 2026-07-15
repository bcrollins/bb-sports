import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesOperatorAccessWallPassword } from '../lib/access-wall';
import {
  createGateCookieToken,
  gateCookieIsConfigured,
  verifyGateCookieToken,
} from '../lib/gate-cookie';

const COOKIE_SECRET = 'test-only-gate-cookie-secret-that-is-long-enough';

test('operator access-wall credential is explicit, exact, and absent by default', () => {
  assert.equal(matchesOperatorAccessWallPassword('requested-password', ''), false);
  assert.equal(matchesOperatorAccessWallPassword('requested-password', 'requested-password'), true);
  assert.equal(matchesOperatorAccessWallPassword('REQUESTED-PASSWORD', 'requested-password'), false);
  assert.equal(matchesOperatorAccessWallPassword('requested-password ', 'requested-password'), false);
});

test('access-wall cookie is signed, revocable, and rejects the retired boolean value', async () => {
  assert.equal(gateCookieIsConfigured(COOKIE_SECRET), true);
  assert.equal(gateCookieIsConfigured('too-short'), false);

  const token = await createGateCookieToken(COOKIE_SECRET);
  assert.notEqual(token, '1');
  assert.equal(await verifyGateCookieToken(token, COOKIE_SECRET), true);
  assert.equal(await verifyGateCookieToken(token, `${COOKIE_SECRET}-rotated`), false);
  assert.equal(await verifyGateCookieToken('1', COOKIE_SECRET), false);
  assert.equal(await verifyGateCookieToken(undefined, COOKIE_SECRET), false);
});
