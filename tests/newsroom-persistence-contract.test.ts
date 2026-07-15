import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');
const queries = readFileSync(new URL('../lib/newsroom-queries.ts', import.meta.url), 'utf8');

test('newsroom persistence creates the complete indexed foundation', () => {
  for (const table of [
    'news_sources',
    'news_signals',
    'news_events',
    'news_event_signals',
    'news_evidence',
    'news_verification_reviews',
    'newsroom_activity',
  ]) {
    assert.match(bootstrap, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
  }
  assert.match(bootstrap, /idx_news_signals_source_external/);
  assert.match(bootstrap, /idx_news_signals_exact_url/);
  assert.match(bootstrap, /idx_news_signals_exact_content/);
  assert.match(schema, /bigserial\('sequence'/);
});

test('verification ledgers are database-enforced append-only with explicit supersession', () => {
  assert.match(bootstrap, /bbsports_reject_newsroom_ledger_mutation/);
  for (const trigger of [
    'news_evidence_append_only',
    'news_verification_reviews_append_only',
    'newsroom_activity_append_only',
  ]) {
    assert.match(bootstrap, new RegExp(`CREATE TRIGGER ${trigger}\\b`));
  }
  assert.match(schema, /supersedesEvidenceId/);
  assert.match(queries, /Superseded evidence must belong to this event/);
  assert.doesNotMatch(queries, /\.delete\((?:newsEvidence|newsVerificationReviews|newsroomActivity)\)/);
});

test('append-only newsroom foreign keys restrict parent deletion and upgrade older SET NULL keys', () => {
  const newsroomStart = schema.indexOf('// ---------- real-time newsroom ----------');
  const publicationStart = schema.indexOf('// ---------- immutable article publication ----------');
  assert.ok(newsroomStart >= 0 && publicationStart > newsroomStart);
  const newsroomSchema = schema.slice(newsroomStart, publicationStart);
  assert.equal(newsroomSchema.match(/onDelete: 'restrict'/g)?.length, 5);
  assert.doesNotMatch(newsroomSchema, /onDelete: '(?:cascade|set null)'/);

  const evidenceDdlStart = bootstrap.indexOf('CREATE TABLE IF NOT EXISTS news_evidence');
  const publicationDdlStart = bootstrap.indexOf('CREATE TABLE IF NOT EXISTS article_revisions');
  assert.ok(evidenceDdlStart >= 0 && publicationDdlStart > evidenceDdlStart);
  const appendOnlyDdl = bootstrap.slice(evidenceDdlStart, publicationDdlStart);
  assert.equal(appendOnlyDdl.match(/ON DELETE RESTRICT/g)?.length, 5);
  assert.doesNotMatch(appendOnlyDdl, /ON DELETE (?:CASCADE|SET NULL)/);

  for (const constraint of [
    'news_evidence_source_id_fkey',
    'news_evidence_signal_id_fkey',
    'news_evidence_added_by_fkey',
    'news_verification_reviews_reviewer_id_fkey',
    'newsroom_activity_actor_user_id_fkey',
  ]) {
    assert.match(bootstrap, new RegExp(`'${constraint}'`));
  }
  assert.match(bootstrap, /confdeltype = 'r'/);
  assert.match(bootstrap, /ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I/);
  assert.match(bootstrap, /ALTER TABLE %I ADD CONSTRAINT %I %s NOT VALID/);
  assert.match(bootstrap, /ALTER TABLE %I VALIDATE CONSTRAINT %I/);
});

test('evidence writes use optimistic concurrency and reopen stale verification', () => {
  assert.match(queries, /source\.commercialStatus !== 'approved'/);
  assert.match(queries, /!source\.enabled/);
  assert.match(queries, /newsEventStateAfterEvidenceAdded\(previousState\)/);
  assert.match(
    queries,
    /eq\(newsEvents\.version, existingEvent\.version\)/,
  );
  assert.match(queries, /verificationReopened: previousState === 'verified'/);
});

test('substantive edits reopen a verified event before it can seed or publish a draft', () => {
  const updateStart = queries.indexOf('export async function updateNewsEvent');
  const verifyStart = queries.indexOf('export async function verifyNewsEvent', updateStart);
  const update = queries.slice(updateStart, verifyStart);

  assert.match(update, /const detailsChanged =/);
  for (const field of ['headline', 'summary', 'sport', 'urgency']) {
    assert.match(update, new RegExp(`parsed\\.${field} !== existing\\.${field}`));
  }
  assert.match(update, /newsEventStateAfterSubstantiveEdit\(requestedState, detailsChanged\)/);
  assert.match(update, /verificationReopened: fromState === 'verified'/);
  assert.match(update, /substantiveEdit: detailsChanged/);
});

test('the signal domain contains no article or public-post mutation boundary', () => {
  const newsroomStart = schema.indexOf('// ---------- real-time newsroom ----------');
  const publicationStart = schema.indexOf('// ---------- immutable article publication ----------');
  assert.ok(newsroomStart >= 0, 'newsroom schema boundary must remain explicit');
  assert.ok(publicationStart > newsroomStart, 'publication must remain a separate schema boundary');
  assert.doesNotMatch(
    schema.slice(newsroomStart, publicationStart),
    /articleId|publishedAt|published:/,
  );
  assert.doesNotMatch(queries, /createArticle|updateArticle|publishedAt|\.insert\(articles\)/);
});
