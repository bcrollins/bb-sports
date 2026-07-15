import assert from 'node:assert/strict';
import test from 'node:test';
import type { Article } from '../lib/articles';
import {
  buildAllRankings,
  buildLeagueRanking,
  getDemotionImpacts,
  getRecentMovements,
  LEAGUE_ORDER,
  readTrashedTeams,
  validateTrashDirective,
  searchFranchises,
} from '../lib/rankings';

function article(input: Partial<Article> & Pick<Article, 'slug' | 'title' | 'date'>): Article {
  return {
    sport: 'general',
    dek: '',
    tags: [],
    aiAssisted: false,
    readingTimeMinutes: 3,
    excerpt: input.title,
    body: '',
    bodyHtml: `<p>${input.title}</p>`,
    ...input,
  };
}

test('baseline rankings have exactly 25 teams per league', () => {
  const rankings = buildAllRankings([]);
  assert.equal(rankings.length, 4);
  assert.deepEqual(rankings.map((r) => r.league), LEAGUE_ORDER);
  for (const ranking of rankings) {
    assert.equal(ranking.ranked.length, 25, `${ranking.label} should have 25 teams`);
    // No two teams share an id or a current rank.
    const ids = new Set(ranking.ranked.map((r) => r.id));
    const ranks = new Set(ranking.ranked.map((r) => r.currentRank));
    assert.equal(ids.size, 25);
    assert.equal(ranks.size, 25);
  }
});

test('readTrashedTeams parses multiple directives and ignores malformed ones', () => {
  const body = `
opening
<!-- bb:trash league=nba team=lakers drop=5 reason="LeBron is 40." -->
middle
<!-- bb:trash league=mlb team=yankees reason="Roster is broken." -->
some prose
<!-- bb:trash league=fake team=ghost -->
<!-- bb:trash league=nfl -->
ending
`;
  const out = readTrashedTeams(article({ slug: 's', title: 't', date: '2026-05-15T00:00:00Z', body }));
  assert.equal(out.length, 2);
  assert.deepEqual(out[0], { league: 'nba', team: 'lakers', reason: 'LeBron is 40.', drop: 5 });
  assert.deepEqual(out[1], { league: 'mlb', team: 'yankees', reason: 'Roster is broken.', drop: undefined });
});

test('demotion drop is clamped to [1, 10] regardless of directive value', () => {
  const cases: Array<{ drop: string; expected: number }> = [
    { drop: '0', expected: 1 },
    { drop: '1', expected: 1 },
    { drop: '5', expected: 5 },
    { drop: '10', expected: 10 },
    { drop: '99', expected: 10 },
    { drop: 'NaN', expected: 3 },
  ];
  for (const { drop, expected } of cases) {
    const body = `<!-- bb:trash league=nba team=lakers drop=${drop} reason="x" -->`;
    const ranking = buildLeagueRanking('nba', [
      article({ slug: `s-${drop}`, title: 't', date: '2026-05-15T00:00:00Z', body }),
    ]);
    const lakers = ranking.ranked.find((r) => r.id === 'lakers')!;
    assert.equal(lakers.demotions[0]?.drop, expected, `drop=${drop} → ${expected}`);
  }
});

test('demotion to an unknown team is silently ignored', () => {
  const ranking = buildLeagueRanking('nfl', [
    article({
      slug: 's',
      title: 't',
      date: '2026-05-15T00:00:00Z',
      body: '<!-- bb:trash league=nfl team=does-not-exist reason="x" -->',
    }),
  ]);
  assert.equal(ranking.movements.length, 0);
  assert.equal(ranking.ranked.length, 25);
});

test('cumulative drop compounds across articles, newest demotion appears first', () => {
  const ranking = buildLeagueRanking('mlb', [
    article({
      slug: 'older',
      title: 'older',
      date: '2026-05-10T00:00:00Z',
      body: '<!-- bb:trash league=mlb team=yankees drop=2 reason="older reason" -->',
    }),
    article({
      slug: 'newer',
      title: 'newer',
      date: '2026-05-12T00:00:00Z',
      body: '<!-- bb:trash league=mlb team=yankees drop=4 reason="newer reason" -->',
    }),
  ]);
  const yankees = ranking.ranked.find((r) => r.id === 'yankees')!;
  assert.equal(yankees.demotions.length, 2);
  assert.equal(yankees.demotions[0]?.articleSlug, 'newer', 'newest demotion is first');
  assert.equal(yankees.demotions[1]?.articleSlug, 'older');
  // Cumulative drop is 6 slots; yankees baseline is #4. They sit behind every
  // base-rank team whose base+drop score is < 10, then themselves at position 9
  // (tiebreaker against base-rank #10 favours the smaller base-rank).
  assert.equal(yankees.currentRank, 9);
  assert.equal(yankees.baseRank, 4);
});

test('getDemotionImpacts resolves team display data for the article callout', () => {
  const target = article({
    slug: 'lakers-tribute',
    title: 'The Lakers are not a real team',
    date: '2026-05-13T18:00:00Z',
    body: '<!-- bb:trash league=nba team=lakers drop=6 reason="Tribute act." -->',
  });
  const impacts = getDemotionImpacts(target, [target]);
  assert.equal(impacts.length, 1);
  assert.equal(impacts[0]?.team.id, 'lakers');
  assert.equal(impacts[0]?.team.city, 'Los Angeles');
  assert.equal(impacts[0]?.team.name, 'Lakers');
  assert.equal(impacts[0]?.appliedDrop, 6);
  assert.equal(impacts[0]?.leagueLabel, 'NBA');
  assert.ok(impacts[0]!.team.currentRank > impacts[0]!.team.baseRank);
});

test('articles with no directives produce no demotion impacts', () => {
  const a = article({ slug: 'no-trash', title: 'plain', date: '2026-05-13T00:00:00Z', body: 'just body' });
  assert.deepEqual(getDemotionImpacts(a, [a]), []);
});

test('demotion does not push a team below #25 even with extreme cumulative drops', () => {
  const heavy = Array.from({ length: 4 }, (_, i) =>
    article({
      slug: `hit-${i}`,
      title: 't',
      date: `2026-05-1${i}T00:00:00Z`,
      body: '<!-- bb:trash league=nba team=celtics drop=10 reason="x" -->',
    }),
  );
  const ranking = buildLeagueRanking('nba', heavy);
  const celtics = ranking.ranked.find((r) => r.id === 'celtics')!;
  // Celtics start at #1 with a cumulative drop of 40. They land somewhere in the list,
  // but the list still has exactly 25 teams and ranks 1..25.
  assert.equal(ranking.ranked.length, 25);
  const ranks = ranking.ranked.map((r) => r.currentRank).sort((a, b) => a - b);
  assert.deepEqual(ranks, Array.from({ length: 25 }, (_, i) => i + 1));
  assert.ok(celtics.currentRank > 1, 'celtics dropped from #1');
  assert.ok(celtics.currentRank <= 25, 'celtics still in the top 25');
});

test('demotion engine is league-scoped — a directive for one league never mutates another', () => {
  const articles = [
    article({
      slug: 'mlb-trash',
      title: 'mlb',
      date: '2026-05-15T00:00:00Z',
      body: '<!-- bb:trash league=mlb team=yankees drop=8 reason="x" -->',
    }),
  ];
  const nba = buildLeagueRanking('nba', articles);
  assert.equal(nba.movements.length, 0, 'nba untouched by mlb directive');

  const mlb = buildLeagueRanking('mlb', articles);
  // Yankees with a directive get the demotions[] entry; the teams above
  // the Yankees' new position also shift (their currentRank changes) so
  // movements[] is longer than 1. The directive ownership we care about
  // is: only the Yankees has a recorded demotion entry on its row.
  const teamsWithDemotions = mlb.ranked.filter((r) => r.demotions.length > 0);
  assert.equal(teamsWithDemotions.length, 1, 'only one team has a demotion entry');
  assert.equal(teamsWithDemotions[0]?.id, 'yankees');
  assert.ok(mlb.movements.length >= 1, 'at least the yankees moved');
});

test('buildAllRankings returns the four leagues in canonical order', () => {
  const all = buildAllRankings([]);
  assert.deepEqual(
    all.map((r) => r.league),
    ['nfl', 'mlb', 'nhl', 'nba'],
  );
});

test('searchFranchises matches by team name, city, and id with priority on exact name match', () => {
  const yankees = searchFranchises('yankees', []);
  assert.ok(yankees.length > 0);
  assert.equal(yankees[0]?.team.id, 'yankees');
  assert.equal(yankees[0]?.league, 'mlb');

  // Partial match: "Lake" should hit Lakers.
  const lake = searchFranchises('lake', []);
  assert.ok(lake.some((h) => h.team.id === 'lakers'));

  // Multi-word: "Los Angeles" should hit both Lakers and Rams (sport-agnostic).
  const la = searchFranchises('Los Angeles', []);
  const cities = new Set(la.map((h) => h.team.id));
  assert.ok(cities.has('lakers'));
  assert.ok(cities.has('rams'));
});

test('searchFranchises returns empty for queries under 2 characters', () => {
  assert.deepEqual(searchFranchises('', []), []);
  assert.deepEqual(searchFranchises('y', []), []);
});

test('searchFranchises caps results to the limit argument', () => {
  const hits = searchFranchises('s', [], 3);
  assert.ok(hits.length <= 3);
});

test('getRecentMovements returns newest demotion first across all leagues', () => {
  const articles = [
    article({
      slug: 'older-mlb',
      title: 'older mlb',
      date: '2026-05-10T00:00:00Z',
      body: '<!-- bb:trash league=mlb team=yankees drop=4 reason="older" -->',
    }),
    article({
      slug: 'newer-nba',
      title: 'newer nba',
      date: '2026-05-13T00:00:00Z',
      body: '<!-- bb:trash league=nba team=lakers drop=5 reason="newer" -->',
    }),
    article({
      slug: 'newest-nfl',
      title: 'newest nfl',
      date: '2026-05-16T00:00:00Z',
      body: '<!-- bb:trash league=nfl team=cowboys drop=6 reason="newest" -->',
    }),
  ];
  const out = getRecentMovements(articles);
  assert.equal(out.length, 3);
  assert.equal(out[0]?.article.slug, 'newest-nfl');
  assert.equal(out[1]?.article.slug, 'newer-nba');
  assert.equal(out[2]?.article.slug, 'older-mlb');
});

test('Brad\'s teams across the four major leagues carry the bradTeam flag', () => {
  const all = buildAllRankings([]);
  const flagged = new Map<string, string[]>();
  for (const ranking of all) {
    const teams = ranking.ranked.filter((t) => t.bradTeam).map((t) => t.id);
    if (teams.length) flagged.set(ranking.league, teams);
  }
  assert.deepEqual(flagged.get('nfl'), ['bears'], 'Bears flagged in NFL');
  assert.deepEqual(flagged.get('mlb'), ['cubs'], 'Cubs flagged in MLB');
  assert.deepEqual(flagged.get('nhl'), ['panthers'], 'Panthers flagged in NHL');
  assert.deepEqual(flagged.get('nba'), ['bulls'], 'Bulls flagged in NBA');
});

test('getRecentMovements respects the limit and returns [] when no demotions exist', () => {
  assert.deepEqual(getRecentMovements([]), []);

  const heavy = Array.from({ length: 6 }, (_, i) =>
    article({
      slug: `hit-${i}`,
      title: 't',
      date: `2026-05-0${i + 1}T00:00:00Z`,
      body: `<!-- bb:trash league=nba team=lakers drop=1 reason="r${i}" -->`,
    }),
  );
  // Same team demoted 6 times → only one movement entry (the latest).
  const out = getRecentMovements(heavy, 4);
  assert.equal(out.length, 1);
  assert.equal(out[0]?.article.slug, 'hit-5', 'newest article wins');
});

test('validateTrashDirective rejects unknown league/team', () => {
  assert.equal(validateTrashDirective({ league: 'cricket', team: 'bears', reason: 'x' }).ok, false);
  assert.equal(validateTrashDirective({ league: 'nfl', team: 'nope', reason: 'x' }).ok, false);
  assert.equal(validateTrashDirective({ league: 'nfl', team: 'bears', reason: 'real case' }).ok, true);
});
