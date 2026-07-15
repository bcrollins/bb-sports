import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('rollback runbook exists and forbids destructive data recovery shortcuts', () => {
  const path = new URL('../docs/operations/ROLLBACK.md', import.meta.url);
  assert.ok(existsSync(path));
  const body = readFileSync(path, 'utf8');
  assert.match(body, /EXPECTED_COMMIT/);
  assert.match(body, /\/api\/health/);
  assert.match(body, /Never truncate Postgres/i);
  assert.match(body, /Never auto-publish/i);
  assert.match(body, /soft-launch|BBSPORTS_PUBLIC_LAUNCH/i);
  assert.match(body, /railway deployment/i);
});

test('smoke script supports expected commit pin for post-rollback verification', () => {
  const smoke = readFileSync(new URL('../scripts/smoke-production.mjs', import.meta.url), 'utf8');
  assert.match(smoke, /EXPECTED_COMMIT|expectedCommit/);
  assert.match(smoke, /commitsMatch/);
});
