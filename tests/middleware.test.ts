import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('middleware keeps newsletter intake available behind the soft-launch wall', async () => {
  const source = await readFile(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.ok(source.includes("'/api/newsletter'"));
  assert.ok(source.includes("'/api/newsletter/unsubscribe'"));
});
