import assert from 'node:assert/strict';
import test from 'node:test';
import {
  compactStripeId,
  donationStatusLabel,
  donationStatusTone,
  formatDonationMoney,
  summarizeDonationLedger,
} from '../lib/donation-ledger';

test('donation ledger labels and tones expose Stripe payment state clearly', () => {
  assert.equal(donationStatusLabel('checkout_open'), 'Checkout open');
  assert.equal(donationStatusLabel('paid'), 'Paid');
  assert.equal(donationStatusLabel('payment_failed'), 'Payment failed');
  assert.equal(donationStatusLabel('manual_review'), 'Manual review');

  assert.equal(donationStatusTone('paid'), 'green');
  assert.equal(donationStatusTone('checkout_open'), 'yellow');
  assert.equal(donationStatusTone('payment_failed'), 'red');
  assert.equal(donationStatusTone('waiting_for_stripe'), 'navy');
});

test('donation ledger money and Stripe references are operator-readable', () => {
  assert.equal(formatDonationMoney(2500), '$25.00');
  assert.equal(formatDonationMoney(null, 'usd', '$0.00'), '$0.00');
  assert.equal(formatDonationMoney(1250, 'eur'), '€12.50');
  assert.equal(compactStripeId(null), '-');
  assert.equal(compactStripeId('pi_123'), 'pi_123');
  assert.equal(compactStripeId('cs_test_1234567890abcdefghijklmnopqrstuvwxyz'), 'cs_test_1234...uvwxyz');
});

test('donation ledger summary counts paid, open, waiting, and failed rails', () => {
  const summary = summarizeDonationLedger([
    { status: 'waiting_for_stripe' },
    { status: 'checkout_pending' },
    { status: 'checkout_open' },
    { status: 'ready_to_pay' },
    { status: 'paid', stripeAmountReceivedCents: 2500 },
    { status: 'paid', stripeAmountReceivedCents: 500 },
    { status: 'payment_failed' },
    { status: 'checkout_expired' },
  ]);

  assert.deepEqual(summary, {
    waiting: 1,
    open: 3,
    paid: 2,
    failed: 2,
    paidCents: 3000,
  });
});
