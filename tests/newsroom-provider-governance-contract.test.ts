import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
const schema = readFileSync(new URL('../lib/db/schema.ts', import.meta.url), 'utf8');
const queries = readFileSync(
  new URL('../lib/newsroom-provider-queries.ts', import.meta.url),
  'utf8',
);
const client = readFileSync(new URL('../lib/db/client.ts', import.meta.url), 'utf8');
const providers = readFileSync(
  new URL('../lib/newsroom-providers.ts', import.meta.url),
  'utf8',
);
const desk = readFileSync(
  new URL('../app/admin/news-desk/_components/NewsDesk.tsx', import.meta.url),
  'utf8',
);

test('provider governance tables and indexes are bootstrapped', () => {
  for (const table of [
    'news_providers',
    'news_provider_leases',
    'news_provider_checkpoints',
    'news_provider_ingest_attempts',
    'news_provider_dead_letters',
  ]) {
    assert.match(bootstrap, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}\\b`));
    assert.match(schema, new RegExp(`'${table}'`));
  }

  for (const index of [
    'idx_news_providers_commercial',
    'idx_news_provider_leases_expires',
    'idx_news_provider_checkpoints_updated',
    'idx_news_provider_ingest_provider_time',
    'idx_news_provider_dead_letters_open',
  ]) {
    assert.match(bootstrap, new RegExp(index));
  }
});

test('provider seed stays dark and never stores secrets', () => {
  assert.match(bootstrap, /NEWSROOM_PROVIDER_CATALOG/);
  assert.match(bootstrap, /configEnabled: entry\.configEnabledDefault/);
  assert.match(bootstrap, /credentialPresence: 'absent'/);
  assert.doesNotMatch(bootstrap, /X_BEARER_TOKEN\s*[:=]\s*['"][^'"]+['"]/);
  assert.doesNotMatch(schema, /bearer_token|api_key|password_hash.*provider/i);
  assert.match(schema, /credentialEnvNames/);
  assert.match(schema, /credentialPresence/);
  assert.match(schema, /retentionPosture/);
  assert.match(schema, /fenceToken/);
});

test('ingest attempts are append-only and dead letters resolve only once', () => {
  assert.match(bootstrap, /news_provider_ingest_attempts_append_only/);
  assert.match(bootstrap, /bbsports_guard_news_provider_dead_letter/);
  assert.match(bootstrap, /may only set resolution fields/);
  assert.match(bootstrap, /cannot be changed after resolution/);
  assert.match(queries, /recordProviderIngestAttempt/);
  assert.match(queries, /recordProviderDeadLetter/);
  assert.match(queries, /resolveProviderDeadLetter/);
  assert.match(queries, /secret-bearing keys/);
});

test('checkpoint writes require a live matching fencing token', () => {
  assert.match(queries, /canWriteWithFence/);
  assert.match(queries, /FENCE_REJECTED/);
  assert.match(queries, /writeProviderCheckpoint/);
  assert.match(queries, /acquireProviderLease/);
  assert.match(queries, /releaseProviderLease/);
  assert.match(bootstrap, /fence_token integer NOT NULL CHECK \(fence_token > 0\)/);
});

test('activation evaluation never claims transport is allowed from config', () => {
  assert.match(providers, /transportAllowed: false/);
  assert.match(providers, /Never true from configuration alone/);
  assert.match(queries, /recentSuccess: false/);
  assert.match(desk, /Sources: Manual only/);
  assert.match(desk, /external X, Bluesky, and RSS monitoring is not active/);
});

test('postgres client filters only known-harmless bootstrap notices', () => {
  assert.match(client, /isHarmlessBootstrapNotice/);
  assert.match(client, /onnotice: onPostgresNotice/);
  assert.match(client, /\[postgres \$\{severity\}\]/);
  assert.match(providers, /already exists, skipping/);
  assert.match(providers, /severity !== 'NOTICE'/);
});

test('provider governance cannot publish or verify editorial state', () => {
  assert.doesNotMatch(queries, /verifyNewsEvent|publishArticle|createArticle|articles\.published/);
  assert.doesNotMatch(schema, /news_providers[\s\S]{0,800}published/);
  assert.match(schema, /No table here publishes articles or verifies newsroom events/);
});
