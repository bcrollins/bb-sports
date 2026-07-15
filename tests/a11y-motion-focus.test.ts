import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('globals.css honors reduced motion and keyboard focus-visible rings', () => {
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(css, /scroll-behavior:\s*auto\s*!important/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /outline:\s*3px solid var\(--bb-breaking\)/);
  assert.match(css, /\.bb-breaking-pill::before[\s\S]*animation:\s*none/);
});

test('loading skeletons disable pulse under reduced motion', () => {
  const article = readFileSync(
    new URL('../app/(site)/articles/[slug]/loading.tsx', import.meta.url),
    'utf8',
  );
  const archive = readFileSync(new URL('../app/(site)/articles/loading.tsx', import.meta.url), 'utf8');
  assert.match(article, /motion-reduce:animate-none/);
  assert.match(archive, /motion-reduce:animate-none/);
});

test('desk ticker already fails closed for reduced motion', () => {
  const bar = readFileSync(new URL('../components/BreakingNewsBar.tsx', import.meta.url), 'utf8');
  assert.match(bar, /motion-reduce:animate-none|prefers-reduced-motion/);
});

test('skip link exists for keyboard users', () => {
  const layout = readFileSync(new URL('../app/(site)/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /Skip to main content/);
  assert.match(layout, /href="#main"/);
});
