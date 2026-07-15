import assert from 'node:assert/strict';
import test from 'node:test';
import { getResendEmailConfig } from '../lib/resend';
import { assertR2UploadAllowed, getR2StorageConfig, putR2Object } from '../lib/r2-storage';
import { assertProviderMayRun } from '../lib/provider-registry';

test('Resend fails closed without approval flag even with API key', () => {
  const cfg = getResendEmailConfig({
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'desk@bbsports.fans',
  });
  assert.equal(cfg.enabled, false);
  assert.ok(cfg.missing.includes('BBSPORTS_APPROVED_RESEND'));
});

test('Resend enables only with approval + key + from', () => {
  const cfg = getResendEmailConfig({
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'desk@bbsports.fans',
    BBSPORTS_APPROVED_RESEND: 'true',
  });
  assert.equal(cfg.enabled, true);
});

test('R2 uploads fail closed without approval and never network when gated', async () => {
  const cfg = getR2StorageConfig({});
  assert.equal(cfg.ready, false);
  assert.equal(assertR2UploadAllowed({}).ok, false);
  const put = await putR2Object({ key: 'x.png', body: 'nope' });
  assert.equal(put.ok, false);
});

test('provider registry blocks stripe/resend/r2 when pending commercial', () => {
  assert.equal(assertProviderMayRun('stripe', {}).ok, false);
  assert.equal(assertProviderMayRun('resend', { RESEND_API_KEY: 'x' }).ok, false);
  assert.equal(assertProviderMayRun('cloudflare-r2', {}).ok, false);
});
