import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('article and archive loading/not-found states exist', () => {
  assert.ok(existsSync(new URL('../app/(site)/articles/[slug]/loading.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/(site)/articles/[slug]/not-found.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/(site)/articles/loading.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/not-found.tsx', import.meta.url)));
  assert.ok(existsSync(new URL('../app/error.tsx', import.meta.url)));

  const articleNf = readFileSync(
    new URL('../app/(site)/articles/[slug]/not-found.tsx', import.meta.url),
    'utf8',
  );
  assert.match(articleNf, /Article unavailable|isn.?t published/i);
  assert.match(articleNf, /\/articles/);
  assert.match(articleNf, /\/search/);

  const page = readFileSync(new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url), 'utf8');
  assert.match(page, /notFound\s*\(/);
});
