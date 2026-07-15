import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const ingest = readFileSync(new URL('../lib/newsroom-ingest.ts', import.meta.url), 'utf8');
const queries = readFileSync(
  new URL('../lib/newsroom-ingest-queries.ts', import.meta.url),
  'utf8',
);
const bootstrap = readFileSync(new URL('../lib/db/bootstrap.ts', import.meta.url), 'utf8');
const desk = readFileSync(
  new URL('../app/admin/news-desk/_components/NewsDesk.tsx', import.meta.url),
  'utf8',
);

test('ingest transaction is atomic, gated, and appends only signal activity', () => {
  assert.match(queries, /export async function ingestProviderCandidate/);
  assert.match(queries, /decideProviderIngestGate/);
  assert.match(queries, /database\.transaction/);
  assert.match(queries, /signal\.provider_created/);
  assert.match(queries, /signal\.provider_deduplicated/);
  assert.match(queries, /onConflictDoNothing/);
  assert.match(queries, /recordProviderIngestAttempt/);
  assert.match(queries, /verified: false/);
  assert.match(queries, /published: false/);
});

test('provider ingest never verifies or publishes', () => {
  assert.doesNotMatch(queries, /verifyNewsEvent|publishArticle|createArticleDraft|event\.verified/);
  assert.doesNotMatch(queries, /articles\.|publishedSnapshot|BRAD APPROVES/);
  assert.doesNotMatch(ingest, /fetch\(|WebSocket|http\.request/);
  assert.match(ingest, /never marks events verified/);
  assert.match(ingest, /publishes articles/);
});

test('bootstrap seeds dark provider intake sources for every provider', () => {
  assert.match(bootstrap, /provider-intake:\$\{providerKey\}/);
  assert.match(bootstrap, /sourceType: 'provider_intake'/);
  assert.match(bootstrap, /enabled: false/);
  assert.match(bootstrap, /tier: 'unverified'/);
  assert.match(bootstrap, /Synthetic provider intake source/);
});

test('raw provider bodies are excluded from durable provenance by contract', () => {
  assert.match(ingest, /Full restricted bodies are/);
  assert.match(ingest, /intentionally excluded/);
  assert.match(ingest, /SECRET_KEY_PATTERN/);
  assert.match(ingest, /MAX_PROVIDER_PROVENANCE_JSON_BYTES/);
  assert.match(queries, /rawPayload: normalized\.rawPayload/);
});

test('desk still does not claim live external monitoring from parsers alone', () => {
  assert.match(desk, /deskSourcesLabel \?\? 'Manual only'/);
  assert.match(desk, /external X, Bluesky, and RSS monitoring is not active/);
  assert.match(desk, /transportAllowed: false/);
});
