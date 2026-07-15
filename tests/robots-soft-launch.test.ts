import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildRobotsDecision,
  shouldEmitRssItems,
  shouldEmitSitemapEntries,
} from '../lib/crawl-policy';

test('soft launch: robots disallow entire site and omit sitemap', () => {
  const decision = buildRobotsDecision(
    { BBSPORTS_PUBLIC_LAUNCH: undefined, NEXT_PUBLIC_SITE_URL: 'https://bbsports.fans' },
    'https://bbsports.fans',
  );
  assert.equal(decision.searchIndexable, false);
  assert.equal(decision.mode, 'soft_launch');
  assert.deepEqual(decision.robots.rules, [{ userAgent: '*', disallow: '/' }]);
  assert.equal(decision.robots.sitemap, undefined);
  assert.equal(decision.robots.host, 'https://bbsports.fans');
  assert.equal(shouldEmitSitemapEntries({}), false);
  assert.equal(shouldEmitRssItems({}), false);
});

test('public launch: robots allow public routes and link sitemap', () => {
  const decision = buildRobotsDecision(
    { BBSPORTS_PUBLIC_LAUNCH: 'true', NEXT_PUBLIC_SITE_URL: 'https://bbsports.fans' },
    'https://bbsports.fans',
  );
  assert.equal(decision.searchIndexable, true);
  assert.equal(decision.mode, 'public');
  assert.deepEqual(decision.robots.rules, [
    { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
  ]);
  assert.equal(decision.robots.sitemap, 'https://bbsports.fans/sitemap.xml');
  assert.equal(shouldEmitSitemapEntries({ BBSPORTS_PUBLIC_LAUNCH: 'true' }), true);
  assert.equal(shouldEmitRssItems({ BBSPORTS_PUBLIC_LAUNCH: 'true' }), true);
});

test('robots.ts, sitemap, RSS, and layout all wire crawl/soft-launch policy', () => {
  const robotsSrc = readFileSync(new URL('../app/robots.ts', import.meta.url), 'utf8');
  const sitemapSrc = readFileSync(new URL('../app/sitemap.ts', import.meta.url), 'utf8');
  const rssSrc = readFileSync(new URL('../app/rss.xml/route.ts', import.meta.url), 'utf8');
  const layoutSrc = readFileSync(new URL('../app/layout.tsx', import.meta.url), 'utf8');
  assert.match(robotsSrc, /buildRobotsDecision/);
  assert.match(sitemapSrc, /shouldEmitSitemapEntries/);
  assert.match(rssSrc, /shouldEmitRssItems/);
  assert.match(layoutSrc, /evaluateSoftLaunchPosture/);
  assert.match(layoutSrc, /index:\s*false/);
});
