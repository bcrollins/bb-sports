import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');

test('ops bundle flattens entrypoints to .ops root for Railway SSH paths', () => {
  assert.match(pkg, /--entry-names=\[name\]/);
  assert.match(pkg, /worker\/newsroom-worker\.ts/);
  assert.match(pkg, /scripts\/verify-publication-postgres\.ts/);
  assert.match(pkg, /outdir=\.ops/);
  // Nested entry-names would break ops/*.mjs SSH paths.
  assert.doesNotMatch(pkg, /--entry-names=\[dir\]\/\[name\]/);
});
