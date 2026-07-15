import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildNewsletterWelcomeEmail,
  newsletterOneClickUnsubscribeUrl,
  newsletterUnsubscribeUrl,
} from '../lib/resend';

const apiRoute = readFileSync(
  new URL('../app/api/newsletter/unsubscribe/route.ts', import.meta.url),
  'utf8',
);
const page = readFileSync(
  new URL('../app/(site)/newsletter/unsubscribe/page.tsx', import.meta.url),
  'utf8',
);
const queries = readFileSync(new URL('../lib/queries.ts', import.meta.url), 'utf8');

test('GET unsubscribe surfaces are read-only and POST owns mutation', () => {
  assert.match(apiRoute, /export async function GET/);
  assert.match(apiRoute, /getNewsletterSubscriberByToken/);
  assert.match(apiRoute, /mutates:\s*false/);
  assert.doesNotMatch(
    apiRoute.split('export async function GET')[1] ?? '',
    /unsubscribeNewsletterSubscriber/,
  );
  assert.match(apiRoute, /export async function POST/);
  assert.match(apiRoute, /List-Unsubscribe/);
  assert.match(apiRoute, /unsubscribeNewsletterSubscriber/);

  assert.match(page, /getNewsletterSubscriberByToken/);
  assert.doesNotMatch(page, /unsubscribeNewsletterSubscriber/);
  assert.match(page, /method="POST"/);
  assert.match(page, /Confirm unsubscribe|Yes, unsubscribe me/);
});

test('queries expose read-only token lookup separate from suppress', () => {
  assert.match(queries, /export async function getNewsletterSubscriberByToken/);
  assert.match(queries, /export async function unsubscribeNewsletterSubscriber/);
  assert.match(queries, /already-unsubscribed|status === 'unsubscribed'/);
});

test('welcome email advertises human page + RFC one-click API URLs', () => {
  const token = 'a'.repeat(48);
  const human = newsletterUnsubscribeUrl('https://bbsports.fans', token);
  const oneClick = newsletterOneClickUnsubscribeUrl('https://bbsports.fans', token);
  assert.equal(human, `https://bbsports.fans/newsletter/unsubscribe?token=${token}`);
  assert.equal(oneClick, `https://bbsports.fans/api/newsletter/unsubscribe?token=${token}`);

  const payload = buildNewsletterWelcomeEmail({
    to: 'reader@example.com',
    from: 'desk@bbsports.fans',
    unsubscribeUrl: human,
    oneClickUnsubscribeUrl: oneClick,
  });
  assert.equal(payload.headers['List-Unsubscribe'], `<${oneClick}>`);
  assert.equal(payload.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.match(payload.html, /newsletter\/unsubscribe\?token=/);
  assert.doesNotMatch(payload.html, /api\/newsletter\/unsubscribe/);
});
