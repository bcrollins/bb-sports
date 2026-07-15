import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  sessionLabelFromJti,
  summarizeNetwork,
  summarizeUserAgent,
} from '../lib/admin-sessions';

test('session summaries never expose raw IP or full user-agent tokens', () => {
  assert.equal(summarizeNetwork('203.0.113.44'), '203.0.x.x');
  assert.equal(summarizeNetwork('unknown'), 'Network unknown');
  assert.match(summarizeUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0'), /Chrome on macOS/);
  assert.match(summarizeUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS) Safari/605'), /Safari on iOS/);
  assert.equal(sessionLabelFromJti('abcdef12-3456-7890'), 'sess_abcdef12');
  assert.doesNotMatch(summarizeNetwork('198.51.100.10'), /198\.51\.100\.10/);
});

test('sessions admin page and revoke API are wired', () => {
  assert.ok(existsSync(new URL('../app/admin/account/sessions/page.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/api/admin/sessions/revoke/route.ts', import.meta.url)));
  const page = readFileSync(new URL('../app/admin/account/sessions/page.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../app/api/admin/sessions/revoke/route.ts', import.meta.url), 'utf8');
  const lib = readFileSync(new URL('../lib/admin-sessions.ts', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../app/admin/layout.tsx', import.meta.url), 'utf8');
  assert.match(page, /requireAdminPage/);
  assert.match(page, /listSafeSessionsForUser/);
  assert.doesNotMatch(page, /ipAddress|jwtId|bb_session/);
  assert.match(api, /getCurrentUser/);
  assert.match(api, /revokeSessionByIdForUser|revokeOtherSessionsForUser/);
  assert.match(api, /recordAdminAuditEvent/);
  assert.match(lib, /summarizeNetwork/);
  assert.match(layout, /\/admin\/account\/sessions/);
});
