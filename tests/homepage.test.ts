import assert from 'node:assert/strict';
import test from 'node:test';
import type { Article } from '../lib/articles';
import {
  buildHomepageDesk,
  HOME_PRIMARY_ACTIONS,
  isLiveScoreProviderApproved,
} from '../lib/homepage';
import { SUPPORT_AMOUNTS } from '../lib/support';
import { normalizeSearchQuery, searchArticles } from '../lib/search';
import { buildLeagueRanking } from '../lib/rankings';

function article(input: Partial<Article> & Pick<Article, 'slug' | 'title' | 'sport' | 'date'>): Article {
  return {
    dek: '',
    tags: [],
    aiAssisted: false,
    readingTimeMinutes: 3,
    excerpt: input.title,
    body: input.title,
    bodyHtml: `<p>${input.title}</p>`,
    ...input,
  };
}

test('homepage desk orders stories by date with no sport categorisation', () => {
  const desk = buildHomepageDesk([
    article({ slug: 'old-nfl', title: 'Old NFL', sport: 'nfl', date: '2026-05-01T12:00:00.000Z' }),
    article({ slug: 'new-nhl', title: 'New NHL', sport: 'nhl', date: '2026-05-03T12:00:00.000Z' }),
    article({ slug: 'cfb', title: 'College football', sport: 'college-football', date: '2026-05-02T12:00:00.000Z' }),
  ], {});

  assert.equal(desk.lead?.slug, 'new-nhl');
  assert.deepEqual(desk.latest.map((a) => a.slug), ['cfb', 'old-nfl']);
  assert.equal(desk.lastUpdated, '2026-05-03T12:00:00.000Z');
  assert.deepEqual(desk.renderedSlugs, ['new-nhl', 'cfb', 'old-nfl']);
  assert.equal(new Set(desk.renderedSlugs).size, desk.renderedSlugs.length);
  assert.ok(!desk.latest.some((a) => a.slug === desk.lead?.slug));
});

test('homepage desk empty catalog is honest', () => {
  const desk = buildHomepageDesk([], {});
  assert.equal(desk.lead, null);
  assert.equal(desk.latest.length, 0);
  assert.equal(desk.lastUpdated, null);
  assert.deepEqual(desk.renderedSlugs, []);
});

test('franchise rankings apply demotions from articles', () => {
  const ranking = buildLeagueRanking('mlb', [
    article({
      slug: 'yankees-window-closed',
      title: 'The Yankees window slammed shut',
      sport: 'mlb',
      date: '2026-05-10T12:00:00.000Z',
      body: '<!-- bb:trash league=mlb team=yankees drop=4 reason="The roster build is broken." -->\n\nbody copy',
    }),
  ]);
  const yankees = ranking.ranked.find((r) => r.id === 'yankees');
  assert.ok(yankees, 'yankees row exists');
  assert.equal(yankees!.demotions.length, 1);
  assert.equal(yankees!.demotions[0]?.articleSlug, 'yankees-window-closed');
  assert.ok(yankees!.currentRank > yankees!.baseRank, 'rank moved down');
});

test('homepage score-style board fails closed without commercial live-score approval', () => {
  assert.equal(isLiveScoreProviderApproved({}), false);
  assert.equal(isLiveScoreProviderApproved({ BBSPORTS_APPROVED_LIVE_SCORES: 'true' }), true);

  const desk = buildHomepageDesk([], {});
  assert.equal(desk.provider.liveScoresApproved, false);
  assert.equal(desk.provider.flag, 'BBSPORTS_APPROVED_LIVE_SCORES');
  assert.match(desk.provider.disclaimer, /No live scores/);
});

test('homepage primary actions keep named homes and avoid bucket navigation', () => {
  const labels = HOME_PRIMARY_ACTIONS.map((action) => action.label.toLowerCase());
  for (const forbidden of ['more', 'other', 'misc', 'menu', 'hamburger']) {
    assert.equal(labels.includes(forbidden), false);
  }
  assert.ok(labels.includes('support'));
  assert.ok(labels.includes('tips'));
});

test('first-party search ranks direct article title matches first', () => {
  const results = searchArticles([
    article({
      slug: 'bears-shot',
      title: 'Why the Bears finally have a real shot',
      sport: 'nfl',
      date: '2026-05-05T12:00:00.000Z',
      dek: 'Chicago is not sneaking up on anybody.',
    }),
    article({
      slug: 'wild-avs',
      title: 'Wild and Avs went off',
      sport: 'nhl',
      date: '2026-05-06T12:00:00.000Z',
      dek: 'A playoff hockey fireworks show.',
    }),
  ], 'Bears');

  assert.equal(results[0]?.article.slug, 'bears-shot');
  assert.ok(results[0]?.matchedFields.includes('title'));
});

test('search query normalization clamps whitespace and length', () => {
  assert.equal(normalizeSearchQuery('  Bears    offensive   line  '), 'Bears offensive line');
  assert.equal(normalizeSearchQuery('x'.repeat(200)).length, 80);
  assert.equal(searchArticles([article({ slug: 'a', title: 'A', sport: 'nfl', date: '2026-05-05T12:00:00.000Z' })], 'x').length, 0);
});

test('support amounts are bounded Stripe-friendly cent values', () => {
  assert.ok(SUPPORT_AMOUNTS.length >= 4);
  for (const amount of SUPPORT_AMOUNTS) {
    assert.equal(Number.isInteger(amount.amountCents), true);
    assert.ok(amount.amountCents >= 100);
    assert.ok(amount.amountCents <= 100_000);
  }
});
