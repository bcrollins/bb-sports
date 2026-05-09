import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('npm start prepares standalone static assets before launching server', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')) as {
    scripts: Record<string, string>;
  };
  const script = await readFile(new URL('../scripts/prepare-standalone.mjs', import.meta.url), 'utf8');

  assert.equal(
    packageJson.scripts.start,
    'node scripts/prepare-standalone.mjs && node .next/standalone/server.js',
  );
  assert.ok(script.includes("copyFresh(join(root, '.next', 'static')"));
  assert.ok(script.includes("const standaloneServer = join(standaloneDir, 'server.js')"));
  assert.ok(script.includes("copyIfPresent(join(root, 'public'"));
});
