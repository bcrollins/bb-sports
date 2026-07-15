import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('backup restore and SLO docs exist with hard safety language', () => {
  assert.ok(existsSync(new URL('../docs/operations/BACKUP-RESTORE.md', import.meta.url)));
  assert.ok(existsSync(new URL('../docs/operations/SLO.md', import.meta.url)));
  const backup = readFileSync(new URL('../docs/operations/BACKUP-RESTORE.md', import.meta.url), 'utf8');
  assert.match(backup, /RPO|RTO/);
  assert.match(backup, /Never restore over production|abort/i);
});

test('audience admin surfaces analytics posture', () => {
  const page = readFileSync(new URL('../app/admin/audience/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /evaluateAnalyticsHashPosture/);
  assert.match(page, /Analytics privacy posture/);
  assert.match(page, /getAnalyticsSnapshot/);
  assert.match(page, /Top events|Top paths/);
});
