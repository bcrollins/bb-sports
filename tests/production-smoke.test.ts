import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('production smoke gate is wired to first-party launch surfaces', async () => {
  const packageJson = JSON.parse(
    await readFile(new URL('../package.json', import.meta.url), 'utf8'),
  ) as {
    scripts: Record<string, string>;
  };
  const smokeScript = await readFile(
    new URL('../scripts/smoke-production.mjs', import.meta.url),
    'utf8',
  );

  assert.equal(packageJson.scripts['smoke:production'], 'node scripts/smoke-production.mjs');
  assert.match(smokeScript, /\/api\/health/);
  assert.match(smokeScript, /\/search\?q=/);
  assert.match(smokeScript, /Find the take\./);
  assert.match(smokeScript, /\/api\/analytics/);
  assert.match(smokeScript, /redirect: 'manual'/);
  assert.match(smokeScript, /BB_PRODUCTION_GATE_COOKIE/);
});
