import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { ARTICLE_HERO_REMOTE_HOSTS } from '../lib/article-publication';

const articlesSource = readFileSync(new URL('../lib/articles.ts', import.meta.url), 'utf8');

function functionSource(name: string, nextName: string): string {
  const start = articlesSource.indexOf(`export async function ${name}`);
  const end = articlesSource.indexOf(`export async function ${nextName}`, start + 1);
  assert.ok(start >= 0, `${name} must exist`);
  assert.ok(end > start, `${name} must have a stable source boundary`);
  return articlesSource.slice(start, end);
}

test('configured Postgres is the only public article catalog', () => {
  const allArticles = functionSource('getAllArticles', 'getArticleBySlug');
  const bySlug = functionSource('getArticleBySlug', 'getRelatedArticles');

  assert.match(
    allArticles,
    /return filesystemArticlesAllowed\(\) \? fromFilesystem\(\) : \[\]/,
  );
  assert.match(allArticles, /const rows = await dbGetPublished\(\)/);
  assert.doesNotMatch(allArticles, /catch|out\.length|fall through/i);

  assert.match(bySlug, /if \(!dbAvailable\)/);
  assert.match(bySlug, /const row = await dbGetBySlug\(slug\)/);
  assert.match(bySlug, /return row \? fromDb\(row\) : null/);
  assert.doesNotMatch(bySlug, /catch|fall through/i);
});

test('production never treats repository markdown as approved when Postgres is missing', () => {
  assert.match(articlesSource, /function filesystemArticlesAllowed\(\): boolean/);
  assert.match(articlesSource, /process\.env\.NODE_ENV !== 'production'/);
  assert.match(articlesSource, /filesystemArticlesAllowed\(\) \? fromFilesystem\(\) : \[\]/);
  assert.match(articlesSource, /if \(!filesystemArticlesAllowed\(\)\) return null/);
});

test('related-story reads cannot cross from a configured database into files', () => {
  const related = articlesSource.slice(articlesSource.indexOf('export async function getRelatedRecommendations'));
  // Catalog path is getAllArticles() only — production + DATABASE_URL never resurrects filesystem drafts.
  assert.match(related, /getAllArticles|rankRelatedArticles/);
  assert.doesNotMatch(related, /fromFilesystem\s*\(/);
  assert.match(articlesSource, /export async function getRelatedArticles/);
});

test('the public article page renders the exact approved author across every surface', () => {
  const page = readFileSync(new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /const authorName = article\.authorName\?\.trim\(\) \|\| 'Brad Benson'/);
  assert.match(page, /authors:\s*\[authorName\]/);
  assert.match(page, /name:\s*authorName/);
  assert.match(page, /By \{authorName\}/);
  assert.doesNotMatch(page, /authors:\s*\['Brad Benson'\]/);
  assert.doesNotMatch(page, />By Brad Benson</);
});

test('next/image remote hosts exactly cover the publication hero allowlist', () => {
  const config = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  assert.deepEqual(ARTICLE_HERO_REMOTE_HOSTS, [
    'images.unsplash.com',
    'cdn.bbsports.media',
    'pbs.twimg.com',
  ]);
  for (const host of ARTICLE_HERO_REMOTE_HOSTS) {
    assert.match(config, new RegExp(`hostname: '${host.replaceAll('.', '\\\.')}'`));
  }
});
