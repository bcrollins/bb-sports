import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { evaluateMutationGuard } from '../lib/mutation-guard';
import { getCanonicalHost, shouldRedirectToCanonical } from '../lib/canonical-host';

test('mutation guard allows same-origin and smoke-style requests, blocks cross-site', () => {
  const host = 'bbsports.fans';
  assert.equal(
    evaluateMutationGuard({
      method: 'POST',
      host,
      origin: 'https://bbsports.fans',
      secFetchSite: 'same-origin',
    }).ok,
    true,
  );
  assert.equal(
    evaluateMutationGuard({
      method: 'POST',
      host,
      origin: null,
      secFetchSite: null,
    }).ok,
    true,
  );
  const blocked = evaluateMutationGuard({
    method: 'POST',
    host,
    origin: 'https://evil.example',
    secFetchSite: 'cross-site',
  });
  assert.equal(blocked.ok, false);
  if (!blocked.ok) assert.equal(blocked.status, 403);

  const crossSiteNoOrigin = evaluateMutationGuard({
    method: 'POST',
    host,
    origin: null,
    secFetchSite: 'cross-site',
  });
  assert.equal(crossSiteNoOrigin.ok, false);
});

test('canonical host redirects www and railway hosts, exempts health and webhooks', () => {
  assert.equal(getCanonicalHost({ NEXT_PUBLIC_SITE_URL: 'https://bbsports.fans' }), 'bbsports.fans');

  const www = shouldRedirectToCanonical({
    host: 'www.bbsports.fans',
    method: 'GET',
    pathname: '/rankings',
  });
  assert.equal(www.redirect, true);
  if (www.redirect) assert.equal(www.locationHost, 'bbsports.fans');

  const railway = shouldRedirectToCanonical({
    host: 'web-production-c65d6.up.railway.app',
    method: 'GET',
    pathname: '/articles',
  });
  assert.equal(railway.redirect, true);

  const health = shouldRedirectToCanonical({
    host: 'www.bbsports.fans',
    method: 'GET',
    pathname: '/api/health/ready',
  });
  assert.equal(health.redirect, false);

  const webhook = shouldRedirectToCanonical({
    host: 'www.bbsports.fans',
    method: 'POST',
    pathname: '/api/stripe/webhook',
  });
  assert.equal(webhook.redirect, false);

  const apex = shouldRedirectToCanonical({
    host: 'bbsports.fans',
    method: 'GET',
    pathname: '/',
  });
  assert.equal(apex.redirect, false);
});

test('public mutation routes wire rejectIfMutationBlocked; Stripe webhook does not', () => {
  for (const rel of [
    '../app/api/contact/route.ts',
    '../app/api/newsletter/route.ts',
    '../app/api/analytics/route.ts',
    '../app/api/donations/route.ts',
    '../app/api/gate/route.ts',
    '../app/api/articles/[slug]/comments/route.ts',
    '../app/api/newsletter/unsubscribe/route.ts',
    '../app/api/admin/login/route.ts',
  ]) {
    const src = readFileSync(new URL(rel, import.meta.url), 'utf8');
    assert.match(src, /rejectIfMutationBlocked/, rel);
  }
  const webhook = readFileSync(new URL('../app/api/stripe/webhook/route.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(webhook, /rejectIfMutationBlocked/);

  const middleware = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.match(middleware, /shouldRedirectToCanonical/);
  assert.match(middleware, /308/);
});
