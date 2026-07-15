import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('npm run check includes lint, types, tests, security audit, and build', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const check = pkg.scripts.check ?? '';
  assert.match(check, /lint/);
  assert.match(check, /typecheck/);
  assert.match(check, /test/);
  assert.match(check, /audit:security/);
  assert.match(check, /build/);
  assert.equal(pkg.scripts['audit:security'], 'npm audit --audit-level=moderate');
  assert.equal(pkg.scripts['smoke:production'], 'node scripts/smoke-production.mjs');
});

test('quality gate inventory covers security, a11y, and publish floors', () => {
  const files = [
    'tests/admin-security-regressions.test.ts',
    'tests/a11y-motion-focus.test.ts',
    'tests/markdown-security.test.ts',
    'tests/article-publication.test.ts',
    'tests/production-smoke.test.ts',
    'tests/robots-soft-launch.test.ts',
  ];
  for (const rel of files) {
    const body = readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
    assert.ok(body.length > 100, `${rel} should exist with substance`);
  }
});
