import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homepage = readFileSync(new URL('../app/(site)/page.tsx', import.meta.url), 'utf8');

test('homepage rankings rail does not claim live league data', () => {
  assert.doesNotMatch(homepage, /Franchise rankings · live/);
  assert.match(homepage, /Brad.*rankings.*editorial|Brad&apos;s rankings · editorial/);
});
