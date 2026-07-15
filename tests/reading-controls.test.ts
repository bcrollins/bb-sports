import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('reading controls component and article wiring exist', () => {
  const controls = readFileSync(
    new URL('../components/ReadingControls.tsx', import.meta.url),
    'utf8',
  );
  const page = readFileSync(
    new URL('../app/(site)/articles/[slug]/page.tsx', import.meta.url),
    'utf8',
  );
  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  assert.match(controls, /bb_reading_prefs_v1/);
  assert.match(controls, /aria-pressed/);
  assert.match(controls, /localStorage/);
  assert.match(page, /ReadingControls/);
  assert.match(page, /article-reading-column/);
  assert.match(css, /data-reading-size/);
  assert.match(css, /data-reading-width/);
});
