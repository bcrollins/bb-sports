/**
 * Asserts every article hero image points to a file that actually
 * exists in /public. A typo in frontmatter or a renamed SVG would
 * silently 404 in the browser; this test catches it before it ships.
 *
 * Only enforces filesystem-rooted heroes (the `/images/...` and
 * `/brand/...` set) — DB-backed heroes can be absolute URLs to R2 or
 * an external CDN, which we don't try to fetch in tests.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { getAllArticles } from '../lib/articles';

const PUBLIC_DIR = path.join(process.cwd(), 'public');

test('every article hero image points to a file that exists in /public', async () => {
  const articles = await getAllArticles();
  const local = articles.filter((a) => a.hero && a.hero.startsWith('/'));
  assert.ok(local.length > 0, 'at least one article has a local hero');

  const missing: Array<{ slug: string; hero: string }> = [];
  for (const article of local) {
    const onDisk = path.join(PUBLIC_DIR, article.hero!.replace(/^\//, ''));
    if (!fs.existsSync(onDisk)) {
      missing.push({ slug: article.slug, hero: article.hero! });
    }
  }
  assert.deepEqual(missing, [], `missing hero images: ${JSON.stringify(missing)}`);
});

test('every article with a local hero declares heroAlt and heroCredit', async () => {
  const articles = await getAllArticles();
  const local = articles.filter((a) => a.hero && a.hero.startsWith('/'));
  const incomplete = local.filter((a) => !a.heroAlt || !a.heroCredit);
  assert.deepEqual(
    incomplete.map((a) => a.slug),
    [],
    'article hero needs alt text + credit (editorial standard)',
  );
});
