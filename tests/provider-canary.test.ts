import assert from 'node:assert/strict';
import test from 'node:test';
import {
  runAllProviderCanaries,
  runLiveScoresCanary,
  runR2Canary,
  runResendCanary,
  runStripeCanary,
} from '../lib/provider-canary';

test('dry-run canaries pass when providers are dark', async () => {
  const env = {};
  const all = await runAllProviderCanaries({ env });
  assert.equal(all.length, 4);
  assert.ok(all.every((r) => r.ok && r.mode === 'dry_run'));
  assert.equal((await runResendCanary({ env })).ok, true);
  assert.equal(runStripeCanary({ env }).ok, true);
  assert.equal((await runR2Canary({ env })).ok, true);
  assert.equal(runLiveScoresCanary({ env }).ok, true);
});

test('resend live path still fails closed without approval', async () => {
  const result = await runResendCanary({
    env: { RESEND_API_KEY: 're_x', RESEND_FROM: 'a@b.c' },
    live: true,
  });
  assert.equal(result.ok, true);
  assert.ok(result.blockers.includes('BBSPORTS_APPROVED_RESEND'));
});
