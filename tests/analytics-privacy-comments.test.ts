import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  analyticsCollectionAllowed,
  evaluateAnalyticsHashPosture,
  hashAnalyticsValue,
  parseAnalyticsPrivacySignals,
} from '../lib/analytics';

test('analytics hash salt never falls back to JWT or public default', () => {
  assert.deepEqual(evaluateAnalyticsHashPosture({}), {
    allowed: false,
    reason: 'analytics_hash_salt_missing',
  });
  assert.deepEqual(
    evaluateAnalyticsHashPosture({ ANALYTICS_HASH_SALT: 'short', JWT_SECRET: 'x'.repeat(32) }),
    { allowed: false, reason: 'analytics_hash_salt_too_short' },
  );
  const shared = 'shared-secret-value-16chars';
  assert.deepEqual(
    evaluateAnalyticsHashPosture({ ANALYTICS_HASH_SALT: shared, JWT_SECRET: shared }),
    { allowed: false, reason: 'analytics_hash_salt_reused_jwt' },
  );
  assert.equal(hashAnalyticsValue('1.2.3.4', { JWT_SECRET: shared }), null);
  assert.equal(hashAnalyticsValue('1.2.3.4', {}), null);
  const ok = hashAnalyticsValue('1.2.3.4', {
    ANALYTICS_HASH_SALT: 'independent-analytics-salt-v1',
    JWT_SECRET: 'different-jwt-secret-value',
  });
  assert.match(ok ?? '', /^[a-f0-9]{64}$/);
});

test('GPC, DNT, and opt-out cookie suppress optional analytics collection', () => {
  assert.equal(analyticsCollectionAllowed({ gpc: false, dnt: false, optOutCookie: false }), true);
  assert.equal(analyticsCollectionAllowed({ gpc: true, dnt: false, optOutCookie: false }), false);
  assert.equal(analyticsCollectionAllowed({ gpc: false, dnt: true, optOutCookie: false }), false);
  assert.equal(analyticsCollectionAllowed({ gpc: false, dnt: false, optOutCookie: true }), false);

  const gpc = parseAnalyticsPrivacySignals({
    headers: { 'sec-gpc': '1' },
  });
  assert.equal(gpc.gpc, true);
  assert.equal(analyticsCollectionAllowed(gpc), false);

  const dnt = parseAnalyticsPrivacySignals({
    headers: { dnt: '1' },
  });
  assert.equal(dnt.dnt, true);

  const cookie = parseAnalyticsPrivacySignals({
    cookieHeader: 'bb_gate=x; bb_analytics=0; other=1',
  });
  assert.equal(cookie.optOutCookie, true);
});

test('analytics API and tracker wire privacy + salt gates', () => {
  const api = readFileSync(new URL('../app/api/analytics/route.ts', import.meta.url), 'utf8');
  const tracker = readFileSync(new URL('../components/AnalyticsTracker.tsx', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../lib/analytics.ts', import.meta.url), 'utf8');
  assert.match(api, /parseAnalyticsPrivacySignals/);
  assert.match(api, /evaluateAnalyticsHashPosture/);
  assert.match(api, /privacy_signal/);
  // Validation must run before salt/privacy short-circuit so invalid events still 400.
  const validateAt = api.indexOf('analyticsPayloadSchema.safeParse');
  const saltAt = api.indexOf('evaluateAnalyticsHashPosture');
  assert.ok(validateAt > -1 && saltAt > -1 && validateAt < saltAt);
  assert.match(tracker, /clientAnalyticsBlocked/);
  assert.match(tracker, /globalPrivacyControl/);
  assert.doesNotMatch(lib, /bb-sports-analytics-v1/);
  assert.doesNotMatch(lib, /JWT_SECRET \|\|/);
});

test('comments API fails closed for non-catalog slugs', () => {
  const route = readFileSync(
    new URL('../app/api/articles/[slug]/comments/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(route, /getPublishedArticleIdBySlug/);
  assert.match(route, /available:\s*false/);
  assert.match(route, /404/);
  assert.match(route, /published catalog/);
});
