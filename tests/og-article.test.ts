import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

test('article OG route is brand-safe text card and gate-bypassed', () => {
  assert.ok(existsSync(new URL('../app/api/og/article/route.tsx', import.meta.url)));
  const route = readFileSync(new URL('../app/api/og/article/route.tsx', import.meta.url), 'utf8');
  const page = readFileSync(
    new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url),
    'utf8',
  );
  const mw = readFileSync(new URL('../middleware.ts', import.meta.url), 'utf8');
  assert.match(route, /ImageResponse/);
  assert.match(route, /1200/);
  assert.match(route, /630/);
  assert.match(route, /BB Sports/);
  assert.doesNotMatch(route, /fetch\(|images\.unsplash/);
  assert.doesNotMatch(route, /src=\{|img src|backgroundImage/);
  assert.match(page, /\/api\/og\/article/);
  assert.match(mw, /\/api\/og\//);
});

test('hero remote hosts stay allowlisted (SSRF floor for media)', () => {
  const pub = readFileSync(new URL('../lib/article-publication.ts', import.meta.url), 'utf8');
  const cfg = readFileSync(new URL('../next.config.mjs', import.meta.url), 'utf8');
  assert.match(pub, /ARTICLE_HERO_REMOTE_HOSTS/);
  assert.match(pub, /images\.unsplash\.com/);
  assert.match(cfg, /images\.unsplash\.com/);
  assert.match(cfg, /cdn\.bbsports\.media/);
});
