import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = process.cwd();

function source(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('newsroom login is gate-bypassed so Brad can sign in without the soft-launch wall', () => {
  const middleware = source('middleware.ts');
  assert.match(
    middleware,
    /GATE_BYPASS_EXACT[\s\S]*['"]\/admin\/login['"]/,
    'middleware must bypass the soft-launch wall for /admin/login',
  );
  assert.match(
    middleware,
    /GATE_BYPASS_EXACT[\s\S]*['"]\/api\/admin\/login['"]/,
    'middleware must bypass the soft-launch wall for /api/admin/login',
  );
  assert.match(
    middleware,
    /pathname\.startsWith\(['"]\/admin['"]\)/,
    'unauthenticated /admin/* visits without a wall cookie must route to newsroom login, not only the public wall',
  );
});

test('login response attaches the session cookie on the NextResponse object', () => {
  const login = source('app/api/admin/login/route.ts');
  assert.match(login, /attachSessionCookie/, 'login must use attachSessionCookie on the response');
  assert.doesNotMatch(
    login,
    /await setSessionCookie/,
    'login must not rely only on cookies().set without attaching to the response',
  );
});

test('admin user seed upserts password hash from Railway env (recovery source of truth)', () => {
  const bootstrap = source('lib/db/bootstrap.ts');
  assert.match(bootstrap, /onConflictDoUpdate/, 'admin seed must upsert, not write-once');
  assert.match(
    bootstrap,
    /passwordHash:\s*adminHash/,
    'admin seed must refresh password_hash from ADMIN_PASSWORD_HASH',
  );
  assert.match(
    bootstrap,
    /role:\s*['"]super_admin['"]/,
    'admin seed must keep Brad as super_admin on recovery upsert',
  );
});

test('production readiness requires newsroom operator credentials', () => {
  const env = source('lib/production-env.ts');
  assert.match(env, /ADMIN_EMAIL/);
  assert.match(env, /ADMIN_PASSWORD_HASH/);
});

test('getCurrentUser fails closed instead of throwing a developer error page', () => {
  const auth = source('lib/auth.ts');
  const start = auth.indexOf('export async function getCurrentUser');
  const end = auth.indexOf('export function verifyPassword', start);
  const body = auth.slice(start, end === -1 ? undefined : end);
  assert.match(body, /try\s*\{/);
  assert.match(body, /catch\s*\{/);
  assert.match(body, /return null/);
});
