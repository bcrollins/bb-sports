import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const header = readFileSync(new URL('../components/SiteHeader.tsx', import.meta.url), 'utf8');

test('masthead does not claim unsupported LIVE product state', () => {
  assert.doesNotMatch(header, /BB · LIVE/);
  assert.match(header, /BB Sports · Fan desk/);
  assert.match(header, /<time/);
});
