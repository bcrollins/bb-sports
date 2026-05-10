import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const searchPageSource = readFileSync(new URL('../app/(site)/search/page.tsx', import.meta.url), 'utf8');

test('search form controls cannot force mobile horizontal overflow', () => {
  assert.match(searchPageSource, /grid w-full min-w-0 gap-3/);
  assert.match(searchPageSource, /min-h-\[50px\] w-full min-w-0 rounded-sm/);
  assert.match(searchPageSource, /bb-button-primary w-full min-w-0/);
});
