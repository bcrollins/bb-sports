import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(
  new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url),
  'utf8',
);

test('article pages emit free NewsArticle JSON-LD with publisher and sport section', () => {
  assert.match(page, /NewsArticle/);
  assert.match(page, /isAccessibleForFree:\s*true/);
  assert.match(page, /NewsMediaOrganization/);
  assert.match(page, /serializeJsonLd\(articleJsonLd\)/);
  assert.match(page, /articleSection/);
  assert.match(page, /creativeWorkStatus/);
});
