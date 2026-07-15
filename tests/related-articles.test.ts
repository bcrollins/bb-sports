import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { rankRelatedArticles, scoreRelatedArticle, tokenizeTitle } from '../lib/related-articles';
import type { Article } from '../lib/articles';

function article(partial: Partial<Article> & Pick<Article, 'slug' | 'title' | 'sport' | 'date'>): Article {
  return {
    tags: [],
    aiAssisted: false,
    readingTimeMinutes: 3,
    excerpt: 'e',
    body: 'b',
    bodyHtml: '<p>b</p>',
    ...partial,
  };
}

const now = Date.parse('2026-07-15T00:00:00.000Z');

test('tokenizeTitle drops stopwords', () => {
  assert.deepEqual(tokenizeTitle('Why the Bears finally have a real shot'), [
    'bears',
    'finally',
    'real',
    'shot',
  ]);
});

test('same-sport recommendations outrank cross-sport recency', () => {
  const source = article({
    slug: 'bears-a',
    title: 'Bears take',
    sport: 'nfl',
    date: '2026-07-10T00:00:00.000Z',
    tags: ['bears'],
  });
  const catalog = [
    article({
      slug: 'packers-b',
      title: 'Packers notes',
      sport: 'nfl',
      date: '2026-06-01T00:00:00.000Z',
    }),
    article({
      slug: 'cubs-fresh',
      title: 'Cubs column brand new',
      sport: 'mlb',
      date: '2026-07-14T00:00:00.000Z',
    }),
  ];
  const ranked = rankRelatedArticles(source, catalog, 2, now);
  assert.equal(ranked[0]?.article.slug, 'packers-b');
  assert.match(ranked[0]?.reason ?? '', /NFL|More on/i);
  assert.ok(!ranked.some((r) => r.article.slug === source.slug));
});

test('title overlap and tags raise score', () => {
  const source = article({
    slug: 'src',
    title: 'Yankees window slammed shut',
    sport: 'mlb',
    date: '2026-07-10T00:00:00.000Z',
    tags: ['yankees'],
  });
  const withTag = article({
    slug: 'tagged',
    title: 'AL East notes',
    sport: 'mlb',
    date: '2026-07-01T00:00:00.000Z',
    tags: ['yankees'],
  });
  const unrelated = article({
    slug: 'other',
    title: 'Soccer only',
    sport: 'soccer',
    date: '2026-07-12T00:00:00.000Z',
  });
  const a = scoreRelatedArticle(source, withTag, now)!;
  const b = scoreRelatedArticle(source, unrelated, now)!;
  assert.ok(a.score > b.score);
  assert.equal(scoreRelatedArticle(source, source, now), null);
});

test('article page renders explainable related reasons', () => {
  const page = readFileSync(new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../lib/articles.ts', import.meta.url), 'utf8');
  assert.match(page, /getRelatedRecommendations/);
  assert.match(page, /rec\.reason/);
  assert.match(page, /Related takes/);
  assert.match(lib, /rankRelatedArticles|getRelatedRecommendations/);
});
