import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('middleware keeps newsletter intake available behind the soft-launch wall', async () => {
  const source = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("'/api/newsletter'"));
  assert.ok(source.includes("'/api/newsletter/unsubscribe'"));
});

test('middleware bypasses gate for public read-only endpoints', async () => {
  const source = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8');
  // Public, machine-readable surfaces must be reachable without the gate
  // so the newsletter, social embeds and external consumers can pull data
  // before public launch.
  assert.ok(source.includes("'/api/health'"));
  assert.ok(source.includes("'/api/rankings'"));
  assert.ok(source.includes("'/sitemap.xml'"));
  assert.ok(source.includes("'/rss.xml'"));
  assert.ok(source.includes("'/robots.txt'"));
});
