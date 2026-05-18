/**
 * Tests for the per-team rankings deep-link routes:
 *   /rankings/[league]/[team] — 100 pre-rendered pages.
 *
 * generateStaticParams() is the source of truth for which paths exist;
 * a regression in it (e.g. losing a league or shedding teams) would
 * silently shrink the set of rendered pages.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { generateStaticParams } from '../app/(site)/rankings/[league]/[team]/page';
import { buildLeagueRanking, LEAGUE_ORDER } from '../lib/rankings';

test('generateStaticParams produces exactly 100 team paths', async () => {
  const params = await generateStaticParams();
  assert.equal(params.length, 100, '4 leagues × 25 teams');
});

test('generateStaticParams covers every league × every baseline team', async () => {
  const params = await generateStaticParams();
  const seen = new Map<string, Set<string>>();
  for (const p of params) {
    if (!seen.has(p.league)) seen.set(p.league, new Set());
    seen.get(p.league)!.add(p.team);
  }
  assert.equal(seen.size, 4, 'all four leagues');
  for (const league of LEAGUE_ORDER) {
    const teams = seen.get(league);
    assert.ok(teams, `${league} has params`);
    assert.equal(teams!.size, 25, `${league} has 25 unique team ids`);
    const baseline = buildLeagueRanking(league, []).ranked;
    for (const team of baseline) {
      assert.ok(teams!.has(team.id), `${league}/${team.id} included`);
    }
  }
});

test('generateStaticParams emits only canonical league slugs', async () => {
  const params = await generateStaticParams();
  for (const p of params) {
    assert.ok(LEAGUE_ORDER.includes(p.league as never), `unknown league: ${p.league}`);
  }
});
