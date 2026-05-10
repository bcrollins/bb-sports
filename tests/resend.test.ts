import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildNewsletterWelcomeEmail,
  getResendEmailConfig,
  newsletterUnsubscribeUrl,
  sendNewsletterWelcomeEmail,
} from '../lib/resend';

test('Resend newsletter config fails closed behind approval and required env', () => {
  const disabled = getResendEmailConfig({});
  assert.equal(disabled.enabled, false);
  assert.deepEqual(disabled.missing, ['BBSPORTS_APPROVED_RESEND', 'RESEND_API_KEY', 'RESEND_FROM']);

  const approved = getResendEmailConfig({
    BBSPORTS_APPROVED_RESEND: 'true',
    RESEND_API_KEY: 're_123',
    RESEND_FROM: 'Brad Benson <brad@mail.bbsports.fans>',
  });
  assert.equal(approved.enabled, true);
  assert.equal(approved.approved, true);
});

test('newsletter welcome email includes visible and header unsubscribe paths', () => {
  const unsubscribeUrl = newsletterUnsubscribeUrl('https://bbsports.fans', 'a'.repeat(48));
  const payload = buildNewsletterWelcomeEmail({
    to: 'fan@example.com',
    from: 'Brad Benson <brad@mail.bbsports.fans>',
    unsubscribeUrl,
  });

  assert.equal(unsubscribeUrl, `https://bbsports.fans/newsletter/unsubscribe?token=${'a'.repeat(48)}`);
  assert.deepEqual(payload.to, ['fan@example.com']);
  assert.equal(payload.headers['List-Unsubscribe'], `<${unsubscribeUrl}>`);
  assert.equal(payload.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(payload.text, /Unsubscribe:/);
  assert.match(payload.html, /Unsubscribe in one click/);
});

test('newsletter welcome send is disabled until Resend is approved', async () => {
  const result = await sendNewsletterWelcomeEmail({
    to: 'fan@example.com',
    unsubscribeToken: 'a'.repeat(48),
    origin: 'https://bbsports.fans',
  }, {}, async () => {
    throw new Error('fetch should not run');
  });

  assert.equal(result.status, 'disabled');
  assert.equal(result.reason, 'resend-not-configured');
});

test('newsletter welcome send posts to Resend with API auth and captures provider id', async () => {
  const request: { url: string; init?: RequestInit } = { url: '' };
  const result = await sendNewsletterWelcomeEmail({
    to: 'fan@example.com',
    unsubscribeToken: 'b'.repeat(48),
    origin: 'https://bbsports.fans',
  }, {
    BBSPORTS_APPROVED_RESEND: 'true',
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'Brad Benson <brad@mail.bbsports.fans>',
  }, async (url, init) => {
    request.url = String(url);
    request.init = init;
    return new Response(JSON.stringify({ id: 'email_123' }), { status: 200 });
  });

  assert.deepEqual(result, { status: 'sent', providerId: 'email_123' });
  assert.equal(request.url, 'https://api.resend.com/emails');
  assert.equal((request.init?.headers as Record<string, string>).Authorization, 'Bearer re_test');
  assert.match(String(request.init?.body), /List-Unsubscribe/);
});

test('newsletter welcome send records Resend failure without throwing', async () => {
  const result = await sendNewsletterWelcomeEmail({
    to: 'fan@example.com',
    unsubscribeToken: 'c'.repeat(48),
    origin: 'https://bbsports.fans',
  }, {
    BBSPORTS_APPROVED_RESEND: 'true',
    RESEND_API_KEY: 're_test',
    RESEND_FROM: 'Brad Benson <brad@mail.bbsports.fans>',
  }, async () => new Response(JSON.stringify({ message: 'domain not verified' }), { status: 403 }));

  assert.deepEqual(result, { status: 'failed', reason: 'domain not verified' });
});
