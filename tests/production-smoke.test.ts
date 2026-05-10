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
  assert.match(smokeScript, /BB_SMOKE_ARTICLE_SLUG/);
  assert.match(smokeScript, /\/articles\/\$\{ARTICLE_SLUG\}/);
  assert.match(smokeScript, /\/api\/articles\/\$\{ARTICLE_SLUG\}\/comments/);
  assert.match(smokeScript, /\/sitemap\.xml/);
  assert.match(smokeScript, /donation readiness contract/);
  assert.match(smokeScript, /\/api\/stripe\/webhook/);
  assert.match(smokeScript, /newsletter welcome contract/);
  assert.match(smokeScript, /newsletter validation guard/);
  assert.match(smokeScript, /contact validation guard/);
  assert.match(smokeScript, /donation validation guard/);
  assert.match(smokeScript, /comment validation guard/);
  assert.match(smokeScript, /198\.51\.100\./);
  assert.match(smokeScript, /\/api\/analytics/);
  assert.match(smokeScript, /redirect: 'manual'/);
  assert.match(smokeScript, /BB_PRODUCTION_GATE_COOKIE/);
});
