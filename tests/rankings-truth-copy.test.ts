import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const homepage = readFileSync(new URL('../app/(site)/page.tsx', import.meta.url), 'utf8');
const rankings = readFileSync(new URL('../app/(site)/rankings/page.tsx', import.meta.url), 'utf8');
const layout = readFileSync(new URL('../app/(site)/layout.tsx', import.meta.url), 'utf8');

test('homepage rankings rail does not claim live league data', () => {
  assert.doesNotMatch(homepage, /Franchise rankings · live/);
  assert.match(homepage, /Brad.*rankings.*editorial|Brad&apos;s rankings · editorial/);
});

test('rankings page states editorial methodology and rejects live-score framing', () => {
  assert.match(rankings, /Methodology · not live scores/);
  assert.match(rankings, /editorial franchise rankings/i);
  assert.match(rankings, /not a licensed\s+standings feed/i);
  assert.match(rankings, /not a real-time product/i);
});

test('site layout publishes NewsMediaOrganization and WebSite JSON-LD', () => {
  assert.match(layout, /NewsMediaOrganization/);
  assert.match(layout, /WebSite/);
  assert.match(layout, /SearchAction/);
  assert.match(layout, /serializeJsonLd/);
});
