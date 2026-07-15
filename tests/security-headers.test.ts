import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const nextConfig = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
const markdown = readFileSync(new URL('../lib/markdown.ts', import.meta.url), 'utf8');

test('production responses declare CSP, HSTS, and baseline hardening headers', () => {
  assert.match(nextConfig, /Content-Security-Policy/);
  assert.match(nextConfig, /Strict-Transport-Security/);
  assert.match(nextConfig, /max-age=63072000/);
  assert.match(nextConfig, /includeSubDomains/);
  assert.match(nextConfig, /X-Frame-Options/);
  assert.match(nextConfig, /X-Content-Type-Options/);
  assert.match(nextConfig, /Referrer-Policy/);
  assert.match(nextConfig, /Permissions-Policy/);
});

test('CSP is enforce-mode and fails closed on the high-risk directives', () => {
  assert.doesNotMatch(nextConfig, /Content-Security-Policy-Report-Only/);
  assert.match(nextConfig, /default-src 'self'/);
  assert.match(nextConfig, /object-src 'none'/);
  assert.match(nextConfig, /base-uri 'self'/);
  assert.match(nextConfig, /frame-ancestors 'self'/);
  assert.match(nextConfig, /form-action 'self'/);
  assert.match(nextConfig, /upgrade-insecure-requests/);
  // No third-party script CDNs in the product CSP surface.
  assert.doesNotMatch(nextConfig, /script-src[^"]*https:\/\//);
});

test('article Markdown path remains sanitized when CSP is the second layer', () => {
  assert.match(markdown, /ARTICLE_MARKDOWN_SANITIZE_SCHEMA/);
  assert.match(markdown, /sanitize:\s*ARTICLE_MARKDOWN_SANITIZE_SCHEMA/);
  assert.match(markdown, /script/);
  assert.match(markdown, /strip:/);
});
