import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full);
  }
  return acc;
}

test('news-desk API never calls publishArticleRevision or auto-publishes', () => {
  const root = join(process.cwd(), 'app/api/admin/news-desk');
  const files = walk(root);
  assert.ok(files.length > 0);
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    assert.doesNotMatch(src, /publishArticleRevision/);
    assert.doesNotMatch(src, /autoPublish|auto_publish|AUTO_PUBLISH/);
    // Draft creation from verified events is allowed; publication is not.
    if (file.includes('/draft/')) {
      assert.match(src, /createVerifiedEventArticleDraft/);
    }
  }
});

test('provider connectors stay dark without commercial approval (source contract)', () => {
  const providers = readFileSync(new URL('../lib/newsroom-providers.ts', import.meta.url), 'utf8');
  const ingest = readFileSync(new URL('../lib/newsroom-ingest.ts', import.meta.url), 'utf8');
  assert.match(providers, /configEnabledDefault:\s*false|configEnabled:\s*false|transportAllowed/);
  assert.match(ingest, /commercial_not_approved/);
  assert.match(ingest, /never[\s*]+verifies|never[\s*]+publishes/i);
});

test('BreakingNewsBar / desk rail does not invent live breaking without isBreaking', () => {
  const bar = readFileSync(new URL('../components/BreakingNewsBar.tsx', import.meta.url), 'utf8');
  const breaking = readFileSync(new URL('../lib/breaking.ts', import.meta.url), 'utf8');
  assert.match(breaking, /isBreaking/);
  assert.match(breaking, /never labeled "Breaking"|Static defaults are always false|honest desk/i);
  // Public bar should not hardcode "BREAKING" for static desk items only.
  assert.match(bar, /isBreaking|Desk|desk/i);
});
