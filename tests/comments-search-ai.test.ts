import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fuzzyTokenMatch, searchArticles } from '../lib/search';
import type { Article } from '../lib/articles';

test('comment thread exposes a11y labels, status live region, and reply focus target', () => {
  const src = readFileSync(new URL('../components/ArticleComments.tsx', import.meta.url), 'utf8');
  assert.match(src, /aria-labelledby="comments-heading"/);
  assert.match(src, /aria-live="polite"/);
  assert.match(src, /role="status"/);
  assert.match(src, /aria-label="Comment thread"/);
  assert.match(src, /getElementById\('comment-body'\)\?\.focus/);
  assert.match(src, /Reply to \{comment\.authorName\}/);
});

test('AI badge is a linked canonical disclosure component', () => {
  const badge = readFileSync(new URL('../components/AiAssistedBadge.tsx', import.meta.url), 'utf8');
  assert.match(badge, /editorial-standards#ai/);
  assert.match(badge, /AI · Brad-edited/);
  const card = readFileSync(new URL('../components/ArticleCard.tsx', import.meta.url), 'utf8');
  assert.match(card, /AiAssistedBadge/);
  const article = readFileSync(
    new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(article, /AiAssistedBadge/);
});

test('fuzzy search tolerates single-character typos on longer tokens', () => {
  // "beers" is edit-distance 1 from "bears"
  assert.equal(fuzzyTokenMatch('bears finally have a real shot', 'beers'), true);
  assert.equal(fuzzyTokenMatch('bears finally have a real shot', 'zz'), false);
  const sample: Article[] = [
    {
      slug: 'why-the-bears-finally-have-a-real-shot',
      title: 'Why the Bears finally have a real shot',
      date: new Date().toISOString(),
      sport: 'nfl',
      tags: ['bears'],
      aiAssisted: false,
      readingTimeMinutes: 4,
      excerpt: 'Caleb and the Chicago Bears.',
      body: 'body',
      bodyHtml: '<p>body</p>',
    },
  ];
  const hits = searchArticles(sample, 'beers');
  assert.ok(hits.length >= 1);
});

test('corrections page reads editorial findings ledger', () => {
  const src = readFileSync(new URL('../app/(site)/corrections/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /editorial_findings/);
  assert.match(src, /corrected|approved_for_edit/);
});
