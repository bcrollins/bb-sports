import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import type { Article } from '../lib/articles';
import {
  LEAGUE_LABELS,
  buildLeagueRanking,
  readTrashedTeams,
  type RankingLeague,
} from '../lib/rankings';

const leagues = Object.keys(LEAGUE_LABELS) as RankingLeague[];

function articleFromMarkdown(slug: string, raw: string): Article {
  return {
    slug,
    title: slug,
    date: '2026-01-01',
    sport: 'general',
    tags: [],
    aiAssisted: false,
    readingTimeMinutes: 1,
    excerpt: '',
    body: raw,
    bodyHtml: '',
  };
}

test('each major league baseline exposes exactly 25 franchises with stable unique ids', () => {
  for (const league of leagues) {
    const ranking = buildLeagueRanking(league, []);
    assert.equal(ranking.ranked.length, 25, `${league} must have 25 ranked franchises`);
    const ids = ranking.ranked.map((team) => team.id);
    assert.equal(new Set(ids).size, 25, `${league} franchise ids must be unique`);
    for (const team of ranking.ranked) {
      assert.ok(team.id.length >= 2, `${league}/${team.name} missing id`);
      assert.ok(team.city.length >= 2, `${league}/${team.id} missing city`);
      assert.ok(team.name.length >= 2, `${league}/${team.id} missing name`);
      assert.ok(team.brad.length >= 20, `${league}/${team.id} needs a substantive Brad take`);
      assert.equal(team.baseRank >= 1 && team.baseRank <= 25, true);
    }
  }
});

test('every article demotion directive targets a known franchise id', () => {
  const articlesDir = join(process.cwd(), 'content/articles');
  const files = readdirSync(articlesDir).filter((name) => name.endsWith('.md'));
  assert.ok(files.length >= 1);

  const validIds = new Map<RankingLeague, Set<string>>();
  for (const league of leagues) {
    validIds.set(
      league,
      new Set(buildLeagueRanking(league, []).ranked.map((team) => team.id)),
    );
  }

  for (const file of files) {
    const body = readFileSync(join(articlesDir, file), 'utf8');
    const article = articleFromMarkdown(file.replace(/\.md$/, ''), body);
    const directives = readTrashedTeams(article);
    for (const entry of directives) {
      const set = validIds.get(entry.league);
      assert.ok(set, `${file}: unknown league ${entry.league}`);
      assert.ok(
        set!.has(entry.team),
        `${file}: demotion targets unknown team id "${entry.team}" in ${entry.league}`,
      );
    }
  }
});

test('rankings are classified as editorial opinion data, not a database encyclopedia', () => {
  const rankingsSource = readFileSync(new URL('../lib/rankings.ts', import.meta.url), 'utf8');
  assert.match(rankingsSource, /Brad's/);
  assert.match(rankingsSource, /opinion/i);
  assert.doesNotMatch(rankingsSource, /pgTable\(|CREATE TABLE/);

  const schema = readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(schema, /\bplayers\b|\bcoaches\b|\brosters\b|player_season/i);
});
