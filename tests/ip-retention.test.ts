import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  NETWORK_METADATA_RETENTION,
  buildRetentionDryRunSql,
} from '../lib/ip-retention';

test('retention policy covers intake tables and produces dry-run SQL only', () => {
  assert.ok(NETWORK_METADATA_RETENTION.some((p) => p.table === 'comments'));
  assert.ok(NETWORK_METADATA_RETENTION.some((p) => p.table === 'analytics_events'));
  const rows = buildRetentionDryRunSql('2026-07-15T00:00:00.000Z');
  assert.ok(rows.length >= 5);
  for (const row of rows) {
    assert.match(row.countSql, /SELECT count/);
    assert.match(row.applySql, /operator only/i);
    assert.doesNotMatch(row.countSql, /DROP TABLE|TRUNCATE/i);
  }
});

test('ip retention docs and analytics salt independence remain wired', () => {
  const doc = readFileSync(new URL('../docs/operations/IP-RETENTION.md', import.meta.url), 'utf8');
  const analytics = readFileSync(new URL('../lib/analytics.ts', import.meta.url), 'utf8');
  assert.match(doc, /Never auto-apply|dry-run/i);
  assert.match(analytics, /analytics_hash_salt_reused_jwt/);
});
