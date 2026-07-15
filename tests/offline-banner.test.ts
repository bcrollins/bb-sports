import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('offline banner is honest and wired into site layout', () => {
  const banner = readFileSync(new URL('../components/OfflineBanner.tsx', import.meta.url), 'utf8');
  const layout = readFileSync(new URL('../app/(site)/layout.tsx', import.meta.url), 'utf8');
  assert.match(banner, /navigator\.onLine/);
  assert.match(banner, /You.?re offline|offline/i);
  assert.match(banner, /do not invent success|not invent success/i);
  assert.match(layout, /OfflineBanner/);
});
