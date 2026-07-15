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

test('the signal domain contains no article or public-post mutation boundary', () => {
  assert.doesNotMatch(schema.slice(schema.indexOf('// ---------- real-time newsroom ----------')), /articleId|publishedAt|published:/);
  assert.doesNotMatch(queries, /createArticle|updateArticle|publishedAt|\.insert\(articles\)/);
});
