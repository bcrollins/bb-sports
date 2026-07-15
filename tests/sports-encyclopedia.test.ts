import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { LEAGUE_SEEDS } from '../lib/sports-encyclopedia/leagues.seed';
import { PERSON_SEEDS } from '../lib/sports-encyclopedia/people.seed';
import { TEAM_SEEDS, assertTeamSeedInvariants } from '../lib/sports-encyclopedia/teams.seed';
import { buildLeagueRanking, LEAGUE_ORDER } from '../lib/rankings';

test('team seeds cover complete major-league franchise counts', () => {
  assert.doesNotThrow(() => assertTeamSeedInvariants());
  assert.equal(LEAGUE_SEEDS.length, 4);
  assert.equal(TEAM_SEEDS.length, 32 + 30 + 32 + 30);
  assert.ok(PERSON_SEEDS.length >= 100, `expected expanded people set, got ${PERSON_SEEDS.length}`);
});

test('people seeds are unique and bias-core teams are represented', () => {
  const keys = PERSON_SEEDS.map((p) => p.personKey);
  assert.equal(keys.length, new Set(keys).size, 'duplicate personKey in PERSON_SEEDS');
  for (const key of keys) {
    assert.match(key, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, `invalid personKey ${key}`);
  }
  // Brad disclosed bias teams must have first-party person rows.
  const requiredTeams = [
    ['nfl', 'chicago-bears'],
    ['nhl', 'florida-panthers'],
    ['mlb', 'chicago-cubs'],
    ['nba', 'chicago-bulls'],
  ] as const;
  for (const [leagueKey, teamKey] of requiredTeams) {
    const count = PERSON_SEEDS.filter((p) => p.leagueKey === leagueKey && p.teamKey === teamKey).length;
    assert.ok(count >= 4, `${teamKey} should have >=4 people, got ${count}`);
  }
  // High-movement stars stay FLAGGED with club-page citations.
  const luka = PERSON_SEEDS.find((p) => p.personKey === 'luka-doncic');
  assert.ok(luka, 'luka-doncic missing');
  assert.equal(luka!.teamKey, 'los-angeles-lakers');
  assert.equal(luka!.dataConfidence, 'FLAGGED');
});

test('every team and person seed carries source citation fields', () => {
  for (const team of TEAM_SEEDS) {
    assert.ok(team.dataSource.length > 8, team.teamKey);
    assert.match(team.dataSourceUrl, /^https:\/\//, team.teamKey);
    assert.ok(['VERIFIED', 'CROSS_REFERENCED', 'FLAGGED'].includes(team.dataConfidence));
    assert.match(team.officialUrl, /^https:\/\//, team.teamKey);
  }
  for (const person of PERSON_SEEDS) {
    assert.ok(person.dataSource.length > 8, person.personKey);
    assert.match(person.dataSourceUrl, /^https:\/\//, person.personKey);
    assert.ok(person.summary.length > 20, `${person.personKey} summary too short`);
    assert.ok(!/PLACEHOLDER|REMOVE|TODO/i.test(person.summary), `${person.personKey} has placeholder summary`);
    assert.ok(
      !/box[-\s]?score|\bWAR\b|\bDVOA\b|scraped stats/i.test(person.summary),
      `${person.personKey} looks like stats scrape`,
    );
    const teamExists = TEAM_SEEDS.some(
      (team) => team.leagueKey === person.leagueKey && team.teamKey === person.teamKey,
    );
    assert.ok(teamExists, `${person.personKey} references missing team`);
  }
});

test('rankings-linked teams resolve to known Brad ranking ids when present', () => {
  for (const league of LEAGUE_ORDER) {
    const rankingIds = new Set(buildLeagueRanking(league, []).ranked.map((t) => t.id));
    const linked = TEAM_SEEDS.filter(
      (team) => team.leagueKey === league && team.rankingsId,
    );
    for (const team of linked) {
      assert.ok(
        rankingIds.has(team.rankingsId!),
        `${team.teamKey} rankingsId ${team.rankingsId} not in Brad baseline`,
      );
    }
  }
});

test('encyclopedia refuses proprietary stats scrape posture in docs and seeds', () => {
  const people = readFileSync(
    new URL('../lib/sports-encyclopedia/people.seed.ts', import.meta.url),
    'utf8',
  );
  assert.match(people, /NOT a scraped career-stats encyclopedia/i);
  assert.match(people, /No proprietary season stats table/i);
  assert.match(people, /personKey: 'patrick-mahomes'/);
  assert.match(people, /personKey: 'shai-gilgeous-alexander'/);

  const teams = readFileSync(
    new URL('../lib/sports-encyclopedia/teams.seed.ts', import.meta.url),
    'utf8',
  );
  assert.match(teams, /NOT stored: proprietary box scores/i);
});

test('schema and bootstrap install encyclopedia tables with confidence checks', () => {
  const schema = readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');
  const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
  for (const table of ['sports_leagues', 'sports_teams', 'sports_people']) {
    assert.match(schema, new RegExp(table));
    assert.match(bootstrap, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(bootstrap, /TEAM_SEEDS/);
  assert.match(bootstrap, /PERSON_SEEDS/);
  assert.match(bootstrap, /onConflictDoUpdate/);
  assert.match(bootstrap, /data_confidence IN \('VERIFIED', 'CROSS_REFERENCED', 'FLAGGED'\)/);
});
