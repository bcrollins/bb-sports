import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  emptyDonationLedgerState,
  netDonationCents,
  reconcileDonationEvent,
} from '../lib/donation-reconcile';
import {
  buildAiProvenance,
  digestPrompt,
  provenanceIsSafe,
} from '../lib/ai-provenance';
import { canPublishHero, validateMediaRights } from '../lib/media-rights';
import { matchWatchlist, parseWatchlistRules } from '../lib/newsroom-watchlist';
import { provenanceForMediaGeneration } from '../lib/xai-media';

test('donation reconcile is idempotent and keeps paid sticky', () => {
  let state = emptyDonationLedgerState();
  state = reconcileDonationEvent(state, {
    type: 'checkout.session.completed',
    eventId: 'evt_1',
    checkoutSessionId: 'cs_1',
    paymentIntentId: 'pi_1',
    amountTotalCents: 2500,
    currency: 'usd',
  });
  assert.equal(state.status, 'paid');
  assert.equal(state.grossPaidCents, 2500);
  const again = reconcileDonationEvent(state, {
    type: 'checkout.session.completed',
    eventId: 'evt_1',
    checkoutSessionId: 'cs_1',
    amountTotalCents: 2500,
  });
  assert.equal(again.seenEventIds.length, 1);
  const expired = reconcileDonationEvent(state, {
    type: 'checkout.session.expired',
    eventId: 'evt_2',
    checkoutSessionId: 'cs_1',
  });
  assert.equal(expired.status, 'paid');
});

test('refunds and disputes update net without erasing gross', () => {
  let state = reconcileDonationEvent(emptyDonationLedgerState(), {
    type: 'checkout.session.completed',
    eventId: 'evt_pay',
    checkoutSessionId: 'cs',
    amountTotalCents: 5000,
  });
  state = reconcileDonationEvent(state, {
    type: 'charge.refunded',
    eventId: 'evt_ref',
    refundAmountCents: 2000,
  });
  assert.equal(state.status, 'partially_refunded');
  assert.equal(state.grossPaidCents, 5000);
  assert.equal(netDonationCents(state), 3000);
  state = reconcileDonationEvent(state, {
    type: 'charge.dispute.created',
    eventId: 'evt_disp',
    disputedAmountCents: 3000,
  });
  assert.equal(state.status, 'disputed');
});

test('AI provenance digests prompts and rejects secret-like material', () => {
  const p = buildAiProvenance({
    provider: 'xai',
    model: 'grok-imagine-image',
    kind: 'image',
    promptOrBrief: 'Abstract navy arena lights for NHL take',
  });
  assert.equal(p.secretsExcluded, true);
  assert.equal(p.promptDigest, digestPrompt('Abstract navy arena lights for NHL take'));
  assert.ok(provenanceIsSafe(p));
  assert.throws(() =>
    buildAiProvenance({
      provider: 'xai',
      model: 'm',
      kind: 'image',
      promptOrBrief: 'use api_key sk-abc123 now',
    }),
  );
  const mediaProv = provenanceForMediaGeneration({
    kind: 'image',
    placement: 'homepage',
    sport: 'nfl',
    title: '',
    brief: 'Bears week-one energy abstract',
    aspectRatio: '16:9',
    resolution: '720p',
    durationSeconds: 8,
    n: 1,
    referenceImageUrl: '',
  });
  assert.ok(provenanceIsSafe(mediaProv));
});

test('media rights gate requires credit, alt, approval, and rejects expired', () => {
  assert.equal(
    validateMediaRights({
      credit: 'BB Sports / xAI',
      altText: 'Abstract stadium lights',
      license: 'ai-generated-xai-approved',
      approved: true,
    }).ok,
    true,
  );
  assert.equal(
    validateMediaRights({
      credit: 'x',
      altText: 'ok alt',
      approved: true,
    }).ok,
    false,
  );
  assert.equal(
    validateMediaRights({
      credit: 'Credit line',
      altText: 'Alt text here',
      approved: true,
      rightsExpiresAt: '2000-01-01T00:00:00.000Z',
    }).ok,
    false,
  );
  assert.equal(canPublishHero({ hero: '/x.jpg', heroAlt: 'a', heroCredit: 'c' }).ok, true);
  assert.equal(canPublishHero({ hero: '/x.jpg', heroAlt: '', heroCredit: 'c' }).ok, false);
});

test('watchlist matches authorized signals only and honors quiet hours', () => {
  const rules = parseWatchlistRules([
    {
      id: 'bears',
      sport: 'nfl',
      team: 'Bears',
      keywords: ['injury'],
      quietStart: '22:00',
      quietEnd: '06:00',
      enabled: true,
      requireAuthorizedSource: true,
    },
  ]);
  const hit = matchWatchlist(rules, {
    text: 'Bears injury update from practice',
    sport: 'nfl',
    team: 'Bears',
    sourceAuthorized: true,
    localMinutes: 12 * 60,
  });
  assert.equal(hit.length, 1);
  const quiet = matchWatchlist(rules, {
    text: 'Bears injury update from practice',
    sport: 'nfl',
    team: 'Bears',
    sourceAuthorized: true,
    localMinutes: 23 * 60,
  });
  assert.equal(quiet.length, 0);
  const unauthorized = matchWatchlist(rules, {
    text: 'Bears injury update from practice',
    sport: 'nfl',
    team: 'Bears',
    sourceAuthorized: false,
    localMinutes: 12 * 60,
  });
  assert.equal(unauthorized.length, 0);
});

test('stripe webhook handles refunds/disputes and uses reconcile', () => {
  const src = readFileSync(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');
  assert.match(src, /reconcileDonationEvent/);
  assert.match(src, /charge\.refunded/);
  assert.match(src, /charge\.dispute/);
});
