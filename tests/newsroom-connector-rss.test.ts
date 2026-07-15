import assert from 'node:assert/strict';
import test from 'node:test';
import {
  evaluateRssFeedUrl,
  isBlockedIpv4,
  isBlockedIpv6,
  readRssStaticPreflight,
  RSS_FETCH_CONTRACT,
} from '../lib/newsroom-connectors/rss-ssrf';

test('RSS fetch contract encodes SSRF and XML hardening bounds', () => {
  assert.deepEqual([...RSS_FETCH_CONTRACT.allowedProtocols], ['https:']);
  assert.equal(RSS_FETCH_CONTRACT.maxRedirects, 3);
  assert.equal(RSS_FETCH_CONTRACT.maxResponseBytes, 2 * 1024 * 1024);
  assert.equal(RSS_FETCH_CONTRACT.xmlHardening.dtd, false);
  assert.equal(RSS_FETCH_CONTRACT.xmlHardening.externalEntities, false);
  assert.equal(RSS_FETCH_CONTRACT.xmlHardening.networkEntityResolution, false);
});

test('RSS URL policy rejects non-HTTPS, userinfo, IP literals, and localhost', () => {
  assert.equal(evaluateRssFeedUrl('http://example.com/feed').ok, false);
  assert.equal(evaluateRssFeedUrl('https://user:pass@example.com/feed').ok, false);
  assert.equal(evaluateRssFeedUrl('https://127.0.0.1/feed').ok, false);
  assert.equal(evaluateRssFeedUrl('https://10.0.0.5/feed').ok, false);
  assert.equal(evaluateRssFeedUrl('https://169.254.169.254/latest/meta-data').ok, false);
  assert.equal(evaluateRssFeedUrl('https://localhost/feed').ok, false);
  assert.equal(evaluateRssFeedUrl('https://[::1]/feed').ok, false);

  const ok = evaluateRssFeedUrl('https://www.ncaa.com/news/football/rss.xml#fragment');
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.canonicalUrl.includes('#'), false);
    assert.equal(ok.hostname, 'www.ncaa.com');
  }
});

test('private IP helpers cover CGNAT and IPv4-mapped IPv6', () => {
  assert.equal(isBlockedIpv4('100.64.1.2'), true);
  assert.equal(isBlockedIpv4('8.8.8.8'), false);
  assert.equal(isBlockedIpv6('::1'), true);
  assert.equal(isBlockedIpv6('fe80::1'), true);
  assert.equal(isBlockedIpv6('::ffff:10.0.0.1'), true);
});

test('RSS static preflight never allows connection', () => {
  const blocked = readRssStaticPreflight({});
  assert.equal(blocked.connectionAllowed, false);

  const approved = readRssStaticPreflight({
    BBSPORTS_NEWSROOM_RSS_ENABLED: 'true',
    BBSPORTS_APPROVED_NEWS_RSS: 'true',
  });
  assert.equal(approved.passed, true);
  assert.equal(approved.connectionAllowed, false);
  if (approved.passed) {
    assert.equal(approved.activationBlocker, 'per_feed_approval_schema_incomplete');
  }
});
