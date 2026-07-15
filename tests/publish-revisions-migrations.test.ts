import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import {
  formatFactCheckAuditLine,
  factCheckRequiredIds,
  validateFactCheckAttestation,
} from '../lib/fact-check-checklist';
import { articlePublishRequestSchema, ARTICLE_PUBLICATION_CONFIRMATION_PHRASE } from '../lib/article-publication';
import {
  changedRevisionFields,
  diffRevisionSnapshots,
  summarizeRevisionDiff,
} from '../lib/article-revision-history';
import {
  checksumSql,
  detectMigrationDrift,
  loadMigrationFiles,
  pendingMigrations,
  SCHEMA_MIGRATION_LOCK_KEY,
} from '../lib/db/migrate';

test('fact-check attestation requires every required id', () => {
  const required = factCheckRequiredIds();
  assert.ok(required.length >= 5);
  assert.equal(validateFactCheckAttestation(required).ok, true);
  assert.equal(validateFactCheckAttestation(required.slice(0, 2)).ok, false);
  assert.equal(validateFactCheckAttestation(['not_a_real_id']).ok, false);
  assert.match(formatFactCheckAuditLine(required), /fact-check-attested/);
});

test('publish schema requires checklistAttestation', () => {
  const base = {
    articleId: '11111111-1111-4111-8111-111111111111',
    expectedRevisionId: '22222222-2222-4222-8222-222222222222',
    expectedContentHash: 'a'.repeat(64),
    confirmation: ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
    rationale: 'Brad verified every claim and approves this exact revision.',
  };
  assert.equal(articlePublishRequestSchema.safeParse(base).success, false);
  assert.equal(
    articlePublishRequestSchema.safeParse({
      ...base,
      checklistAttestation: factCheckRequiredIds(),
    }).success,
    true,
  );
});

test('revision diff highlights field changes for restore UX', () => {
  const before = { title: 'A', body: 'one', sport: 'NFL' };
  const after = { title: 'B', body: 'one', sport: 'NFL' };
  const diff = diffRevisionSnapshots(before, after);
  assert.ok(diff.find((d) => d.field === 'title' && d.changed));
  assert.equal(changedRevisionFields(before, after).length, 1);
  assert.match(summarizeRevisionDiff(before, after), /title/);
});

test('migration files load with stable checksums and drift detection', () => {
  const dir = join(process.cwd(), 'drizzle', 'migrations');
  assert.ok(existsSync(dir));
  const files = loadMigrationFiles(dir);
  assert.ok(files.length >= 1);
  assert.equal(files[0]!.checksum, checksumSql(files[0]!.sqlText));
  assert.equal(SCHEMA_MIGRATION_LOCK_KEY, 872_014_20);

  const applied = files.map((f) => ({
    id: f.id,
    checksum: f.checksum,
    appliedAt: new Date(),
  }));
  assert.equal(detectMigrationDrift(files, applied).ok, true);
  assert.equal(
    detectMigrationDrift(files, [{ ...applied[0]!, checksum: '0'.repeat(64) }]).ok,
    false,
  );
  assert.equal(pendingMigrations(files, applied).length, 0);
  assert.equal(pendingMigrations(files, []).length, files.length);
});

test('editor and routes wire checklist + revision history', () => {
  const editor = readFileSync(
    new URL('../app/admin/articles/_components/ArticleEditor.tsx', import.meta.url),
    'utf8',
  );
  const publishQ = readFileSync(
    new URL('../lib/article-publication-queries.ts', import.meta.url),
    'utf8',
  );
  const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
  assert.match(editor, /FactCheckChecklist/);
  assert.match(editor, /checklistAttestation/);
  assert.match(editor, /RevisionHistoryPanel/);
  assert.match(publishQ, /validateFactCheckAttestation/);
  assert.match(publishQ, /listArticleRevisions/);
  assert.match(bootstrap, /BBSPORTS_SCHEMA_MODE/);
  assert.match(bootstrap, /runVersionedMigrations/);
  assert.ok(
    existsSync(
      new URL('../app/api/admin/articles/[id]/revisions/route.ts', import.meta.url),
    ),
  );
});
