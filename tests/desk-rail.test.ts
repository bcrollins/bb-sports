import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { getDeskRailItems, getBreakingItems } from '../lib/breaking';

const bar = readFileSync(new URL('../components/BreakingNewsBar.tsx', import.meta.url), 'utf8');
const defaults = readFileSync(new URL('../lib/breaking.ts', import.meta.url), 'utf8');

test('default desk rail items are curated editorial, never marked breaking', () => {
  const items = getDeskRailItems();
  assert.ok(items.length >= 4);
  for (const item of items) {
    assert.ok(item.text.length > 10, item.id);
    assert.match(item.href, /^\//, item.id);
    assert.notEqual(item.isBreaking, true, `${item.id} must not claim breaking`);
  }
  // Deprecated alias still returns the same honest defaults.
  assert.equal(getBreakingItems().length, items.length);
});

test('public rail labels static content Desk, not Breaking', () => {
  assert.match(bar, /BB Sports desk|Desk/);
  assert.match(bar, /data-rail-mode/);
  assert.match(bar, /allBreaking/);
  assert.match(defaults, /never labeled ["“]Breaking/i);
  // Pulse animation only when allBreaking is true.
  assert.match(bar, /allBreaking \? \(/);
});

test('static defaults source forbids false breaking presentation language', () => {
  // Component must not hard-code Breaking as the only label for defaults.
  assert.doesNotMatch(bar, /aria-label="Breaking sports news"/);
  assert.match(bar, /aria-label=\{ariaLabel\}/);
});
