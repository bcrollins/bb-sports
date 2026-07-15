import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  archiveActiveChips,
  buildArchiveHref,
  filterArchiveArticles,
  parseArchiveFilters,
} from '../lib/archive-filters';
import type { Article } from '../lib/articles';

const sample: Article[] = [
  {
    slug: 'bears-a',
    title: 'Bears take',
    date: '2026-07-10T00:00:00.000Z',
    sport: 'nfl',
    tags: ['bears'],
    aiAssisted: false,
    readingTimeMinutes: 3,
    excerpt: 'e',
    body: 'b',
    bodyHtml: '<p>b</p>',
  },
  {
    slug: 'cubs-b',
    title: 'Cubs column',
    date: '2026-07-01T00:00:00.000Z',
    sport: 'mlb',
    tags: ['cubs'],
    aiAssisted: false,
    readingTimeMinutes: 3,
    excerpt: 'e',
    body: 'b',
    bodyHtml: '<p>b</p>',
  },
];

test('parseArchiveFilters rejects unknown sport/sort and truncates query', () => {
  const parsed = parseArchiveFilters({
    sport: 'cricket',
    q: '  Bears  ',
    sort: 'weird',
  });
  assert.equal(parsed.sport, 'all');
  assert.equal(parsed.q, 'Bears');
  assert.equal(parsed.sort, 'newest');
  assert.equal(parseArchiveFilters({ sport: 'nfl', sort: 'oldest' }).sport, 'nfl');
  assert.equal(parseArchiveFilters({ sort: 'oldest' }).sort, 'oldest');
});

test('buildArchiveHref omits default sport and sort', () => {
  assert.equal(buildArchiveHref({}), '/articles');
  assert.equal(buildArchiveHref({ sport: 'all', sort: 'newest' }), '/articles');
  assert.equal(buildArchiveHref({ sport: 'nfl', q: 'bears', sort: 'oldest' }), '/articles?sport=nfl&q=bears&sort=oldest');
});

test('filterArchiveArticles respects sport, query, and sort', () => {
  const nfl = filterArchiveArticles(sample, { sport: 'nfl', q: '', sort: 'newest' });
  assert.equal(nfl.length, 1);
  assert.equal(nfl[0]?.slug, 'bears-a');

  const q = filterArchiveArticles(sample, { sport: 'all', q: 'cubs', sort: 'newest' });
  assert.equal(q.length, 1);
  assert.equal(q[0]?.slug, 'cubs-b');

  const oldest = filterArchiveArticles(sample, { sport: 'all', q: '', sort: 'oldest' });
  assert.equal(oldest[0]?.slug, 'cubs-b');
  assert.equal(oldest[1]?.slug, 'bears-a');
});

test('active chips clear individual filters', () => {
  const chips = archiveActiveChips({ sport: 'nfl', q: 'bears', sort: 'oldest' });
  assert.equal(chips.length, 3);
  assert.ok(chips.some((c) => c.clearHref === '/articles?q=bears&sort=oldest'));
  assert.ok(chips.some((c) => c.clearHref === '/articles?sport=nfl&sort=oldest'));
  assert.ok(chips.some((c) => c.clearHref === '/articles?sport=nfl&q=bears'));
});

test('articles archive page wires shareable filter contract', () => {
  const src = readFileSync(new URL('../app/(site)/articles/page.tsx', import.meta.url), 'utf8');
  assert.match(src, /parseArchiveFilters/);
  assert.match(src, /buildArchiveHref/);
  assert.match(src, /archiveActiveChips/);
  assert.match(src, /Clear all/);
  assert.match(src, /sort/);
});
