/**
 * Tests for the public read-only feeds:
 *   GET /rss.xml         — RSS 2.0
 *   GET /api/rankings    — JSON franchise rankings
 *
 * Invokes the route handlers directly so we can assert on the body
 * shape without standing up a full Next server. Both routes read from
 * lib/articles (filesystem fallback when DATABASE_URL is unset, as in
 * the test environment).
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as rssGET } from '../app/rss.xml/route';
import { GET as rankingsGET } from '../app/api/rankings/route';

function nextRequest(url: string): import('next/server').NextRequest {
  const { NextRequest } = require('next/server'); // eslint-disable-line @typescript-eslint/no-require-imports
  return new NextRequest(new Request(url));
}

test('/rss.xml serves a valid RSS 2.0 feed with the launch tagline', async () => {
  const res = await rssGET();
  assert.equal(res.status, 200);
  const contentType = res.headers.get('content-type') ?? '';
  assert.match(contentType, /application\/rss\+xml/);
  const cacheControl = res.headers.get('cache-control') ?? '';
  assert.match(cacheControl, /max-age=300/);

  const body = await res.text();
  assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  assert.match(body, /<rss version="2\.0"/);
  assert.match(body, /<channel>/);
  assert.match(body, /No BS\./, 'channel description contains the launch tagline');
  // At least the welcome anchor article appears in the feed.
  assert.match(body, /<title>Welcome to BB Sports/);
  assert.match(body, /<dc:creator>Brad Benson<\/dc:creator>/);
});

test('/rss.xml escapes XML-special characters in titles and descriptions', async () => {
  const res = await rssGET();
  const body = await res.text();
  // Should never contain a raw &lt;script&gt; or unescaped ampersand inside text.
  assert.equal(body.includes('<script>'), false);
  // Every & must be part of an entity reference.
  const stray = body.match(/&(?!amp;|lt;|gt;|quot;|apos;)/g);
  assert.equal(stray, null, 'no stray ampersands');
});

test('/api/rankings returns all four leagues with 25 teams each', async () => {
  const res = await rankingsGET(nextRequest('https://example.com/api/rankings'));
  assert.equal(res.status, 200);
  const payload = (await res.json()) as {
    leagues: Array<{ league: string; label: string; teams: unknown[] }>;
  };
  assert.equal(payload.leagues.length, 4);
  assert.deepEqual(
    payload.leagues.map((l) => l.league),
    ['nfl', 'mlb', 'nhl', 'nba'],
  );
  for (const league of payload.leagues) {
    assert.equal(league.teams.length, 25, `${league.label} has 25 teams`);
  }
});

test('/api/rankings?league=mlb returns just one league', async () => {
  const res = await rankingsGET(nextRequest('https://example.com/api/rankings?league=mlb'));
  assert.equal(res.status, 200);
  const payload = (await res.json()) as { leagues: Array<{ league: string }> };
  assert.equal(payload.leagues.length, 1);
  assert.equal(payload.leagues[0]?.league, 'mlb');
});

test('/api/rankings rejects unknown leagues with 400 + allowed list', async () => {
  const res = await rankingsGET(nextRequest('https://example.com/api/rankings?league=cricket'));
  assert.equal(res.status, 400);
  const payload = (await res.json()) as { error: string; allowed: string[] };
  assert.equal(payload.error, 'Unknown league');
  assert.deepEqual(payload.allowed, ['nfl', 'mlb', 'nhl', 'nba']);
});

test('/api/rankings sets a 5-minute shared cache header', async () => {
  const res = await rankingsGET(nextRequest('https://example.com/api/rankings'));
  assert.match(res.headers.get('cache-control') ?? '', /s-maxage=300/);
});

test('/api/rankings payload exposes baseline + currentRank + demotions', async () => {
  const res = await rankingsGET(nextRequest('https://example.com/api/rankings'));
  const payload = (await res.json()) as {
    leagues: Array<{
      league: string;
      teams: Array<{
        id: string;
        baseRank: number;
        currentRank: number;
        moved: number;
        demotions: Array<{ articleSlug: string; reason: string; drop: number }>;
      }>;
    }>;
  };
  const mlb = payload.leagues.find((l) => l.league === 'mlb')!;
  const yankees = mlb.teams.find((t) => t.id === 'yankees');
  assert.ok(yankees, 'yankees row exists');
  assert.ok(yankees!.demotions.length >= 1, 'yankees has at least one demotion');
  assert.equal(typeof yankees!.baseRank, 'number');
  assert.equal(typeof yankees!.currentRank, 'number');
  assert.equal(yankees!.moved, yankees!.currentRank - yankees!.baseRank);
});
