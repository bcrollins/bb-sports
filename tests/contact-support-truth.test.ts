import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { formatContactReceiptId } from '../lib/contact-receipt';
import { resolveSupportSurfaceMode } from '../lib/support';

test('contact receipt id is public and non-sensitive', () => {
  assert.equal(
    formatContactReceiptId('a1b2c3d4-e5f6-7890-abcd-ef1234567890'),
    'BB-A1B2C3D4E5F6',
  );
  assert.equal(formatContactReceiptId(''), 'BB-UNKNOWN');
});

test('contact route returns receipt without echoing body', () => {
  const route = readFileSync(new URL('../app/api/contact/route.ts', import.meta.url), 'utf8');
  const page = readFileSync(new URL('../app/(site)/contact/page.tsx', import.meta.url), 'utf8');
  assert.match(route, /receiptId/);
  assert.match(route, /formatContactReceiptId/);
  assert.doesNotMatch(route, /message:\s*message/);
  assert.match(page, /receiptId/);
  assert.match(page, /Receipt ID/);
});

test('support surface fails closed to interest-only without Stripe', () => {
  const mode = resolveSupportSurfaceMode({});
  assert.equal(mode.surface, 'interest_only');
  assert.equal(mode.acceptsMoneyNow, false);
  assert.match(mode.detail, /No card is charged|not open/i);
});

test('support surface is stripe_live when checkout ready', () => {
  const mode = resolveSupportSurfaceMode({
    STRIPE_SECRET_KEY: 'sk_test_x',
    STRIPE_WEBHOOK_SECRET: 'whsec_x',
  });
  assert.equal(mode.surface, 'stripe_live');
  assert.equal(mode.acceptsMoneyNow, true);
});

test('support form declares payment status and never pretends paid without webhook', () => {
  const form = readFileSync(
    new URL('../app/(site)/support/SupportForm.tsx', import.meta.url),
    'utf8',
  );
  const page = readFileSync(new URL('../app/(site)/support/page.tsx', import.meta.url), 'utf8');
  assert.match(form, /data-support-surface/);
  assert.match(form, /webhook|not paid|No payment/i);
  assert.match(page, /resolveSupportSurfaceMode/);
  assert.match(page, /acceptsMoneyNow/);
});
