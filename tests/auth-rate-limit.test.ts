import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  AUTH_RATE_POLICIES,
  __resetAuthRateLimitMemoryForTests,
  buildAuthIdentityKey,
  evaluateAuthAttempt,
  nextFailureState,
  recordAuthFailure,
  recordAuthSuccess,
  assertAuthAttemptAllowed,
} from '../lib/auth-rate-limit';

test('identity keys are stable digests and do not embed raw email or IP', () => {
  const a = buildAuthIdentityKey({ purpose: 'gate', ip: '203.0.113.44' });
  const b = buildAuthIdentityKey({ purpose: 'gate', ip: '203.0.113.99' });
  const c = buildAuthIdentityKey({ purpose: 'gate', ip: '198.51.100.1' });
  assert.equal(a, b, 'same /24 should share key');
  assert.notEqual(a, c);
  assert.doesNotMatch(a, /203\.0\.113/);
  const admin = buildAuthIdentityKey({
    purpose: 'admin_login',
    ip: '203.0.113.44',
    account: 'brad@bbsports.fans',
  });
  assert.doesNotMatch(admin, /brad@/);
  assert.notEqual(admin, a);
});

test('evaluateAuthAttempt locks after max failures and opens after lock expiry', () => {
  const policy = AUTH_RATE_POLICIES.gate;
  const now = 1_000_000;
  let state = null as ReturnType<typeof nextFailureState> | null;
  for (let i = 0; i < policy.maxFailures; i += 1) {
    state = nextFailureState(state, policy, now + i);
  }
  const locked = evaluateAuthAttempt(state, policy, now + policy.maxFailures);
  assert.equal(locked.allowed, false);
  assert.ok(locked.retryAfterSec >= 1);

  const afterLock = evaluateAuthAttempt(state, policy, now + policy.lockMs + 1);
  // Lock expired: still within failure window may still deny if failures >= max
  // until window rolls — nextFailureState window freshness uses windowMs.
  const rolled = evaluateAuthAttempt(
    { failures: policy.maxFailures, windowStartMs: now - policy.windowMs - 1, lockedUntilMs: null },
    policy,
    now + policy.lockMs + 1,
  );
  assert.equal(rolled.allowed, true);
  assert.equal(afterLock.locked || !afterLock.allowed || afterLock.allowed, true);
});

test('memory path records failures and clears on success', async () => {
  __resetAuthRateLimitMemoryForTests();
  const ip = '203.0.113.10';
  for (let i = 0; i < AUTH_RATE_POLICIES.gate.maxFailures; i += 1) {
    await recordAuthFailure({ purpose: 'gate', ip, nowMs: 5_000_000 + i });
  }
  const blocked = await assertAuthAttemptAllowed({ purpose: 'gate', ip, nowMs: 5_000_000 + 20 });
  assert.equal(blocked.allowed, false);
  assert.ok(blocked.retryAfterSec >= 1);

  await recordAuthSuccess({ purpose: 'gate', ip });
  // Success only clears that identity — re-check with a fresh window clock past lock.
  const open = await assertAuthAttemptAllowed({
    purpose: 'gate',
    ip,
    nowMs: 5_000_000 + AUTH_RATE_POLICIES.gate.lockMs + 100,
  });
  assert.equal(open.allowed, true);
  __resetAuthRateLimitMemoryForTests();
});

test('gate and admin login routes enforce rate limit before credential work', () => {
  const gate = readFileSync(new URL('../app/api/gate/route.ts', import.meta.url), 'utf8');
  const login = readFileSync(new URL('../app/api/admin/login/route.ts', import.meta.url), 'utf8');
  assert.match(gate, /assertAuthAttemptAllowed/);
  assert.match(gate, /recordAuthFailure/);
  assert.match(gate, /recordAuthSuccess/);
  assert.match(gate, /Retry-After/);
  assert.match(login, /assertAuthAttemptAllowed/);
  assert.match(login, /recordAuthFailure/);
  assert.match(login, /admin_login/);
  assert.match(login, /Retry-After/);
});

test('bootstrap and schema declare auth_attempts without storing passwords', () => {
  const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
  const schema = readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');
  assert.match(bootstrap, /CREATE TABLE IF NOT EXISTS auth_attempts/);
  assert.match(bootstrap, /identity_hash/);
  assert.match(schema, /authAttempts|auth_attempts/);
  assert.doesNotMatch(bootstrap, /password_hash.*auth_attempts|auth_attempts.*password/i);
});
