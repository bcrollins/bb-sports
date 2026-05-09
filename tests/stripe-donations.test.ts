import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  buildDonationCheckoutSessionParams,
  donationReturnUrls,
  getStripeDonationConfig,
  STRIPE_API_VERSION,
  stripeObjectId,
} from '../lib/stripe';

test('Stripe donation config fails closed without tenant credentials', () => {
  const config = getStripeDonationConfig({
    STRIPE_SECRET_KEY: '',
    STRIPE_WEBHOOK_SECRET: '',
    STRIPE_DONATION_LINK: '',
  });
  assert.equal(config.mode, 'disabled');
  assert.equal(config.checkoutReady, false);
  assert.equal(config.secretReady, false);
  assert.equal(config.webhookReady, false);
  assert.deepEqual(config.missing, ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET']);
});

test('Stripe donation config supports payment-link fallback only for HTTPS links', () => {
  assert.equal(getStripeDonationConfig({ STRIPE_DONATION_LINK: 'http://bad.example' }).mode, 'disabled');
  assert.equal(getStripeDonationConfig({ STRIPE_DONATION_LINK: 'https://buy.stripe.com/test_123' }).mode, 'payment_link');
  assert.equal(getStripeDonationConfig({ STRIPE_SECRET_KEY: 'sk_test_123' }).mode, 'disabled');
  assert.equal(getStripeDonationConfig({
    STRIPE_SECRET_KEY: 'sk_test_123',
    STRIPE_WEBHOOK_SECRET: 'whsec_123',
  }).mode, 'checkout');
});

test('Stripe checkout session params preserve first-party donation metadata', () => {
  assert.equal(STRIPE_API_VERSION, '2026-04-22.dahlia');
  const params = buildDonationCheckoutSessionParams({
    origin: 'https://bbsports.fans',
    donationIntentId: '11111111-1111-4111-8111-111111111111',
    amountCents: 2500,
    email: 'fan@example.com',
    source: 'support-page',
  });

  assert.equal(params.mode, 'payment');
  assert.equal(params.submit_type, 'donate');
  assert.equal(params.customer_email, 'fan@example.com');
  assert.equal(params.metadata?.donation_intent_id, '11111111-1111-4111-8111-111111111111');
  assert.equal(params.metadata?.editorial_independence, 'true');
  assert.equal(params.payment_intent_data?.metadata?.donation_intent_id, params.metadata?.donation_intent_id);
  assert.equal(params.line_items?.[0]?.price_data?.unit_amount, 2500);
});

test('Stripe return URLs keep the Checkout session token unescaped', () => {
  const urls = donationReturnUrls('https://bbsports.fans');
  assert.equal(
    urls.successUrl,
    'https://bbsports.fans/support?status=success&session_id={CHECKOUT_SESSION_ID}',
  );
  assert.equal(urls.cancelUrl, 'https://bbsports.fans/support?status=cancelled');
});

test('Stripe webhook route reads the raw body before signature verification', async () => {
  const source = await readFile(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');
  assert.match(source, /await req\.text\(\)/);
  assert.match(source, /webhooks\.constructEvent\(rawBody, signature, webhookSecret\)/);
  assert.match(source, /checkout\.session\.completed/);
});

test('Stripe object id helper handles expanded and string identifiers', () => {
  assert.equal(stripeObjectId('pi_123'), 'pi_123');
  assert.equal(stripeObjectId({ id: 'cus_123' }), 'cus_123');
  assert.equal(stripeObjectId(null), null);
});
