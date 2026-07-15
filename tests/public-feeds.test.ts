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
import { NextRequest } from 'next/server';
import { GET as rssGET } from '../app/rss.xml/route';
import { GET as rankingsGET } from '../app/api/rankings/route';

function nextRequest(url: string): NextRequest {
  return new NextRequest(new Request(url));
}

function withPublicLaunch<T>(fn: () => Promise<T> | T): Promise<T> | T {
  const prev = process.env.BBSPORTS_PUBLIC_LAUNCH;
  process.env.BBSPORTS_PUBLIC_LAUNCH = 'true';
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env.BBSPORTS_PUBLIC_LAUNCH;
    else process.env.BBSPORTS_PUBLIC_LAUNCH = prev;
  }
}

test('/rss.xml soft launch keeps channel shell without article items', async () => {
  const prev = process.env.BBSPORTS_PUBLIC_LAUNCH;
  delete process.env.BBSPORTS_PUBLIC_LAUNCH;
  try {
    const res = await rssGET();
    assert.equal(res.status, 200);
    const body = await res.text();
    assert.match(body, /<rss version="2\.0"/);
    assert.match(body, /No BS\./);
    assert.equal(body.includes('<item>'), false, 'soft launch must not syndicate items');
  } finally {
    if (prev === undefined) delete process.env.BBSPORTS_PUBLIC_LAUNCH;
    else process.env.BBSPORTS_PUBLIC_LAUNCH = prev;
  }
});

test('/rss.xml serves a valid RSS 2.0 feed with the launch tagline', async () => {
  await withPublicLaunch(async () => {
    const res = await rssGET();
    assert.equal(res.status, 200);
    const contentType = res.headers.get('content-type') ?? '';
    assert.match(contentType, /application\/rss\+xml/);
    const cacheControl = res.headers.get('cache-control') ?? '';
    assert.match(cacheControl, /no-cache/);
    assert.match(cacheControl, /max-age=0/);
    assert.match(cacheControl, /s-maxage=0/);
    assert.match(cacheControl, /must-revalidate/);

    const body = await res.text();
    assert.match(body, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(body, /<rss version="2\.0"/);
    assert.match(body, /<channel>/);
    assert.match(body, /No BS\./, 'channel description contains the launch tagline');
    // At least the welcome anchor article appears in the feed.
    assert.match(body, /<title>Welcome to BB Sports/);
    assert.match(body, /<dc:creator>Brad Benson<\/dc:creator>/);
  });
});

test('/rss.xml escapes XML-special characters in titles and descriptions', async () => {
  await withPublicLaunch(async () => {
    const res = await rssGET();
    const body = await res.text();
    // Should never contain a raw &lt;script&gt; or unescaped ampersand inside text.
    assert.equal(body.includes('<script>'), false);
    // Every & must be part of an entity reference.
    const stray = body.match(/&(?!amp;|lt;|gt;|quot;|apos;)/g);
    assert.equal(stray, null, 'no stray ampersands');
  });
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

test('/api/rankings exposes the bradTeam disclosure flag on every team row', async () => {
  const res = await rankingsGET(nextRequest('https://example.com/api/rankings'));
  const payload = (await res.json()) as {
    leagues: Array<{ league: string; teams: Array<{ id: string; bradTeam: boolean }> }>;
  };

  // Every row must have an explicit boolean (not undefined) so consumers
  // can render a disclosure pill without null-checking the field.
  for (const league of payload.leagues) {
    for (const team of league.teams) {
      assert.equal(typeof team.bradTeam, 'boolean', `${league.league}/${team.id} has boolean bradTeam`);
    }
  }

  // Brad's four major-league franchises specifically.
  const flagged: Record<string, string[]> = {};
  for (const league of payload.leagues) {
    const ids = league.teams.filter((t) => t.bradTeam).map((t) => t.id);
    if (ids.length) flagged[league.league] = ids;
  }
  assert.deepEqual(flagged.nfl, ['bears']);
  assert.deepEqual(flagged.mlb, ['cubs']);
  assert.deepEqual(flagged.nhl, ['panthers']);
  assert.deepEqual(flagged.nba, ['bulls']);
});
