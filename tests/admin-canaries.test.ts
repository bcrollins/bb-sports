import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('admin canaries route is super-admin dry-run only', () => {
  const route = readFileSync(
    new URL('../app/api/admin/canaries/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(route, /runAllProviderCanaries/);
  assert.match(route, /liveResend:\s*false/);
  assert.match(route, /canPublishArticle/);
  assert.match(route, /Forbidden|403/);
});

test('launch page surfaces dry-run canaries and R2/live-score gates', () => {
  const page = readFileSync(new URL('../app/admin/launch/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /runAllProviderCanaries/);
  assert.match(page, /BBSPORTS_APPROVED_R2/);
  assert.match(page, /BBSPORTS_APPROVED_LIVE_SCORES/);
  assert.match(page, /Dry-run provider canaries/);
  assert.match(page, /\/api\/admin\/canaries/);
});

test('Dockerfile ships drizzle migrations for schema mode', () => {
  const docker = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
  assert.match(docker, /COPY.*drizzle/);
});
