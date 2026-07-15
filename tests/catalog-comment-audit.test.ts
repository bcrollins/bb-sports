import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { AUTH_RATE_POLICIES } from '../lib/auth-rate-limit';
import { evaluateSoftLaunchPosture } from '../lib/soft-launch';
import { listFilesystemArticleMeta } from '../lib/article-catalog-reconcile';

test('comment purpose is durable rate-limited at 5 per 10 minutes', () => {
  assert.equal(AUTH_RATE_POLICIES.comment.maxFailures, 5);
  assert.equal(AUTH_RATE_POLICIES.comment.windowMs, 10 * 60_000);
  const queries = readFileSync(new URL('../lib/queries.ts', import.meta.url), 'utf8');
  assert.match(queries, /purpose: 'comment'/);
  assert.match(queries, /recordAuthFailure/);
});

test('catalog import surfaces exist and never auto-publish', () => {
  assert.ok(existsSync(new URL('../lib/catalog-import.ts', import.meta.url)));
  assert.ok(existsSync(new URL('../app/api/admin/catalog/route.ts', import.meta.url)));
  assert.ok(existsSync(new URL('../app/admin/catalog/page.tsx', import.meta.url)));
  const importer = readFileSync(new URL('../lib/catalog-import.ts', import.meta.url), 'utf8');
  assert.match(importer, /published: false/);
  assert.match(importer, /drafts only|Import.*draft/i);
  assert.doesNotMatch(importer, /published:\s*true/);
  const api = readFileSync(new URL('../app/api/admin/catalog/route.ts', import.meta.url), 'utf8');
  assert.match(api, /canPublishArticle/);
  assert.match(api, /recordAdminAuditEvent/);
  assert.ok(listFilesystemArticleMeta().length >= 5);
});

test('admin audit table and UI are present', () => {
  const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
  assert.match(bootstrap, /admin_audit_events/);
  assert.ok(existsSync(new URL('../app/admin/audit/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../lib/admin-audit.ts', import.meta.url)));
});

test('soft-launch posture keeps donations closed and wall on by default', () => {
  const soft = evaluateSoftLaunchPosture({});
  assert.equal(soft.mode, 'soft_launch');
  assert.equal(soft.wallEnabled, true);
  assert.equal(soft.donationsOpen, false);
  assert.equal(soft.searchIndexable, false);

  const pub = evaluateSoftLaunchPosture({
    BBSPORTS_PUBLIC_LAUNCH: 'true',
    BBSPORTS_APPROVED_STRIPE: 'true',
    STRIPE_SECRET_KEY: 'sk_test',
  });
  assert.equal(pub.mode, 'public');
  assert.equal(pub.donationsOpen, true);
});
