/**
 * Tests for the sitemap.xml generator.
 *
 * Covers:
 *   - Static routes include /rankings and the published anchor pages.
 *   - Article URLs are present for every published article.
 *   - All 100 team URLs are present (4 leagues × 25 teams).
 *   - Team page lastModified follows the freshness rules from #47
 *     (demotion date > league latest article date > today).
 *   - Demoted teams get a priority bump from 0.6 → 0.7.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import sitemap, { dynamic } from '../app/sitemap';
import { getAllArticles } from '../lib/articles';

test('production sitemap is generated from the live database catalog', () => {
  assert.equal(dynamic, 'force-dynamic');
});

test('sitemap includes the franchise rankings + key static routes', async () => {
  const entries = await sitemap();
  const urls = entries.map((e) => e.url);
  assert.ok(urls.some((u) => u.endsWith('/rankings')), '/rankings present');
  assert.ok(urls.some((u) => u.endsWith('/articles')), '/articles present');
  assert.ok(urls.some((u) => u.endsWith('/about')), '/about present');
  assert.ok(urls.some((u) => u.endsWith('/support')), '/support present');
});

test('sitemap renders one entry per published article', async () => {
  const articles = await getAllArticles();
  const entries = await sitemap();
  const articleEntries = entries.filter((e) => /\/articles\/[^/]+$/.test(e.url));
  assert.equal(articleEntries.length, articles.length);
});

test('sitemap renders all 100 team pages (4 leagues × 25 teams)', async () => {
  const entries = await sitemap();
  const teamEntries = entries.filter((e) => /\/rankings\/[a-z]+\/[a-z0-9-]+$/.test(e.url));
  assert.equal(teamEntries.length, 100, 'exactly 100 team URLs');
});

test('sitemap renders the four per-league rankings pages', async () => {
  const entries = await sitemap();
  const leagueEntries = entries.filter((e) => /\/rankings\/[a-z]+$/.test(e.url));
  assert.equal(leagueEntries.length, 4);
  for (const slug of ['nfl', 'mlb', 'nhl', 'nba']) {
    assert.ok(leagueEntries.some((e) => e.url.endsWith(`/rankings/${slug}`)), `${slug} league page`);
  }
});

test('demoted team pages get a priority bump in the sitemap', async () => {
  const entries = await sitemap();
  // Yankees were demoted by content/articles/yankees-window-just-slammed.md
  const yankees = entries.find((e) => e.url.endsWith('/rankings/mlb/yankees'));
  assert.ok(yankees, 'yankees in sitemap');
  assert.equal(yankees!.priority, 0.7);

  // Brewers have no demotion published against them.
  const brewers = entries.find((e) => e.url.endsWith('/rankings/mlb/brewers'));
  assert.ok(brewers, 'brewers in sitemap');
  assert.equal(brewers!.priority, 0.6);
});

test('demoted team lastModified matches the demotion article date', async () => {
  const articles = await getAllArticles();
  const yankeeColumn = articles.find((a) => a.slug === 'yankees-window-just-slammed');
  assert.ok(yankeeColumn, 'yankees demotion column exists');
  const expected = new Date(yankeeColumn!.date).toISOString().slice(0, 10);

  const entries = await sitemap();
  const yankees = entries.find((e) => e.url.endsWith('/rankings/mlb/yankees'))!;
  const actual = (yankees.lastModified instanceof Date
    ? yankees.lastModified
    : new Date(yankees.lastModified!))
    .toISOString()
    .slice(0, 10);
  assert.equal(actual, expected, 'yankees lastModified matches column date');
});
