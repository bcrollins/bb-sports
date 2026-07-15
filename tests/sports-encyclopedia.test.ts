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
  assert.match(bootstrap, /data_confidence IN \('VERIFIED', 'CROSS_REFERENCED', 'FLAGGED'\)/);
});
