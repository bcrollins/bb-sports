import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const queries = readFileSync(
  new URL('../lib/article-publication-queries.ts', import.meta.url),
  'utf8',
);
const generalQueries = readFileSync(new URL('../lib/queries.ts', import.meta.url), 'utf8');
const mediaRoute = readFileSync(
  new URL('../app/api/admin/media/[id]/route.ts', import.meta.url),
  'utf8',
);

test('generated hero readiness is checked and row-locked at prepare and publish', () => {
  const helperStart = queries.indexOf('async function assertHeroMediaPublicationReady');
  const helperEnd = queries.indexOf('function activeEvidence', helperStart);
  const helper = queries.slice(helperStart, helperEnd);
  const prepareStart = queries.indexOf('export async function createArticleRevision');
  const statusStart = queries.indexOf('export async function getArticlePublicationStatus');
  const publishStart = queries.indexOf('export async function publishArticleRevision');
  const unpublishStart = queries.indexOf('export async function unpublishArticle');
  const prepare = queries.slice(prepareStart, statusStart);
  const publish = queries.slice(publishStart, unpublishStart);

  assert.match(helper, /mediaAssets\.kind/);
  assert.match(helper, /mediaAssets\.status/);
  assert.match(helper, /mediaAssets\.contentType/);
  assert.match(helper, /mediaAssets\.approved/);
  assert.match(helper, /length\(\$\{mediaAssets\.dataBase64\}\) > 0/);
  assert.match(helper, /\.for\('share'\)/);
  assert.match(
    helper,
    /if \(!hero\) return;[\s\S]*if \(!mediaId\) \{[\s\S]*Publication heroes must use an approved BB Sports media-library asset/,
  );
  assert.match(prepare, /await assertHeroMediaPublicationReady\(tx, snapshot\.hero\)/);
  assert.match(publish, /await assertHeroMediaPublicationReady\(tx, revisionSnapshot\.hero\)/);
});

test('status fails closed before presenting an unavailable generated hero as reviewable', () => {
  const statusStart = queries.indexOf('export async function getArticlePublicationStatus');
  const publishStart = queries.indexOf('export async function publishArticleRevision');
  const status = queries.slice(statusStart, publishStart);
  assert.match(status, /articleHeroMediaAssetId\(article\.hero\)/);
  assert.match(status, /draftHash && article\.hero && !mediaId/);
  assert.match(
    status,
    /Publication heroes must use an approved BB Sports media-library asset with durable immutable bytes/,
  );
  assert.match(status, /draftHash = null/);
  assert.match(status, /draftValidationError = issue/);
});

test('live generated heroes cannot be unapproved through the media workflow', () => {
  const updateStart = generalQueries.indexOf('export async function updateMediaAsset');
  const commentsStart = generalQueries.indexOf('// ---------- comments', updateStart);
  const update = generalQueries.slice(updateStart, commentsStart);

  assert.match(update, /\.transaction\(async \(tx\)/);
  assert.match(update, /FROM media_assets WHERE id = \$\{id\} FOR UPDATE/);
  assert.match(update, /patch\.approved === false/);
  assert.match(update, /eq\(articles\.published, true\)/);
  assert.match(update, /publishedSnapshot\}->>'hero'/);
  assert.match(update, /MediaAssetConflictError/);
  assert.match(update, /media_assets_live_article_ready/);
  assert.match(mediaRoute, /error instanceof MediaAssetConflictError/);
  assert.match(mediaRoute, /code: 'MEDIA_IN_USE'/);
  assert.match(mediaRoute, /status: 409/);
});
