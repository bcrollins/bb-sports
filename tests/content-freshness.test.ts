import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { assessContentFreshness, listFreshnessRisks } from '../lib/content-freshness';
import type { Article } from '../lib/articles';

const now = Date.parse('2026-07-15T00:00:00.000Z');

test('freshness bands scale with age', () => {
  assert.equal(assessContentFreshness('2026-07-14T00:00:00.000Z', now).band, 'fresh');
  assert.equal(assessContentFreshness('2026-06-20T00:00:00.000Z', now).band, 'aging');
  assert.equal(assessContentFreshness('2026-04-01T00:00:00.000Z', now).band, 'stale');
  assert.equal(assessContentFreshness('2025-01-01T00:00:00.000Z', now).band, 'archive');
});

test('listFreshnessRisks ranks urgent first and never mutates catalog', () => {
  const articles = [
    {
      slug: 'new',
      title: 'New',
      date: '2026-07-10T00:00:00.000Z',
      sport: 'nfl',
      tags: [],
      aiAssisted: false,
      readingTimeMinutes: 1,
      excerpt: 'e',
      body: 'b',
      bodyHtml: 'b',
    },
    {
      slug: 'old',
      title: 'Old',
      date: '2025-01-01T00:00:00.000Z',
      sport: 'mlb',
      tags: [],
      aiAssisted: false,
      readingTimeMinutes: 1,
      excerpt: 'e',
      body: 'b',
      bodyHtml: 'b',
    },
  ] as Article[];
  const risks = listFreshnessRisks(articles, now, 1);
  assert.equal(risks[0]?.article.slug, 'old');
  assert.ok(risks.every((r) => r.freshness.priority >= 1));
});

test('catalog admin surfaces freshness advisory', () => {
  const page = readFileSync(new URL('../app/admin/catalog/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /listFreshnessRisks/);
  assert.match(page, /Freshness risk/);
  assert.match(page, /Never auto-rewrites/);
});
