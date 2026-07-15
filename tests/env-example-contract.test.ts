import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');

function declared(name: string): boolean {
  return new RegExp(`^${name}=`, 'm').test(example);
}

test('env.example declares runtime commercial gates with correct names', () => {
  // Live scores: code reads BBSPORTS_APPROVED_LIVE_SCORES — not the stale *_FEED alias.
  assert.ok(declared('BBSPORTS_APPROVED_LIVE_SCORES'));
  assert.ok(!declared('BBSPORTS_APPROVED_LIVE_SCORES_FEED'));
  assert.ok(declared('BBSPORTS_APPROVED_R2'));
  assert.ok(declared('BBSPORTS_APPROVED_RESEND'));
  assert.ok(declared('BBSPORTS_APPROVED_XAI'));
  assert.ok(declared('BBSPORTS_APPROVED_STRIPE'));
  assert.ok(declared('BBSPORTS_PUBLIC_LAUNCH'));
  assert.ok(declared('BBSPORTS_SCHEMA_MODE'));
  assert.ok(declared('ANALYTICS_HASH_SALT'));
  assert.ok(declared('JWT_SECRET'));
  assert.ok(declared('BBSPORTS_NEWSROOM_WORKER_ENABLED'));
});

test('code live-scores flag matches env.example', () => {
  const live = readFileSync(new URL('../lib/live-scores.ts', import.meta.url), 'utf8');
  const r2 = readFileSync(new URL('../lib/r2-storage.ts', import.meta.url), 'utf8');
  assert.match(live, /BBSPORTS_APPROVED_LIVE_SCORES/);
  assert.doesNotMatch(live, /BBSPORTS_APPROVED_LIVE_SCORES_FEED/);
  assert.match(r2, /BBSPORTS_APPROVED_R2/);
});

test('env.example documents commercial canary runbook path', () => {
  assert.match(example, /COMMERCIAL-CANARIES|end-to-end canary/i);
});
