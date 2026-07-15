import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import test from 'node:test';
import {
  assertLiveScoresAllowed,
  evaluateLiveScoresPosture,
  liveScoresUnavailableMessage,
} from '../lib/live-scores';
import {
  buildCatalogReconcileManifest,
  listFilesystemArticleMeta,
} from '../lib/article-catalog-reconcile';

test('live and ready health endpoints exist and stay distinct from combined health', () => {
  assert.ok(existsSync(new URL('../app/api/health/live/route.ts', import.meta.url)));
  assert.ok(existsSync(new URL('../app/api/health/ready/route.ts', import.meta.url)));
  const live = readFileSync(new URL('../app/api/health/live/route.ts', import.meta.url), 'utf8');
  const ready = readFileSync(new URL('../app/api/health/ready/route.ts', import.meta.url), 'utf8');
  const combined = readFileSync(new URL('../app/api/health/route.ts', import.meta.url), 'utf8');
  assert.match(live, /check: 'live'/);
  assert.doesNotMatch(live, /db\.execute|SELECT 1/);
  assert.match(ready, /check: 'ready'/);
  assert.match(ready, /database_not_configured|database_unreachable/);
  assert.match(combined, /endpoints/);
  assert.match(combined, /\/api\/health\/live/);
});

test('public status page is honest and links machine probes', () => {
  const page = readFileSync(new URL('../app/(site)/status/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /BB Sports status/);
  assert.match(page, /Live scores/);
  assert.match(page, /not_enabled|Not enabled/);
  assert.match(page, /\/api\/health\/live/);
  assert.match(page, /evaluateLiveScoresPosture/);
});

test('live scores fail closed without commercial approval and credentials', () => {
  const blocked = evaluateLiveScoresPosture({});
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.reason, 'commercial_approval_required');
  assert.match(liveScoresUnavailableMessage(blocked), /not enabled/i);

  const approvedNoKey = evaluateLiveScoresPosture({ BBSPORTS_APPROVED_LIVE_SCORES: 'true' });
  assert.equal(approvedNoKey.allowed, false);
  assert.equal(approvedNoKey.reason, 'credentials_missing');

  const open = evaluateLiveScoresPosture({
    BBSPORTS_APPROVED_LIVE_SCORES: 'true',
    LIVE_SCORES_API_KEY: 'test-key',
  });
  assert.equal(open.allowed, true);

  assert.throws(() => assertLiveScoresAllowed({}), /Live scores blocked/);
});

test('catalog reconcile manifest never invents publish and lists filesystem-only candidates', () => {
  const fsMeta = listFilesystemArticleMeta();
  assert.ok(fsMeta.length >= 5);
  const manifest = buildCatalogReconcileManifest({
    filesystem: fsMeta,
    databasePublishedSlugs: fsMeta.slice(0, 2).map((f) => f.slug),
  });
  assert.equal(manifest.both.length, 2);
  assert.ok(manifest.filesystemOnly.length >= 1);
  assert.match(manifest.recommendation, /Never auto-publish|drafts only/i);
  for (const entry of manifest.filesystemOnly) {
    assert.equal(entry.publishedInDb, false);
    assert.equal(entry.source, 'filesystem');
  }
});
