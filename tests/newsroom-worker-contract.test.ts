import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const loop = readFileSync(new URL('../lib/newsroom-worker/loop.ts', import.meta.url), 'utf8');
const entry = readFileSync(new URL('../worker/newsroom-worker.ts', import.meta.url), 'utf8');
const runtime = readFileSync(new URL('../lib/newsroom-worker/runtime.ts', import.meta.url), 'utf8');
const pkg = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
const desk = readFileSync(
  new URL('../app/admin/news-desk/_components/NewsDesk.tsx', import.meta.url),
  'utf8',
);

test('worker is a separate process with health, leases, and clean shutdown', () => {
  assert.match(entry, /createNewsroomWorker/);
  assert.match(entry, /SIGTERM/);
  assert.match(entry, /SIGINT/);
  assert.match(entry, /WORKER_HEALTH_PORT/);
  assert.match(entry, /BBSPORTS_NEWSROOM_WORKER_ENABLED/);
  assert.match(loop, /acquireProviderLease/);
  assert.match(loop, /releaseProviderLease/);
  assert.match(loop, /releaseAllLeases/);
  assert.match(runtime, /BoundedWorkQueue/);
  assert.match(runtime, /calculateWorkerBackoff/);
});

test('worker never claims live ingest or opens provider transports', () => {
  assert.match(entry, /activelyIngesting: false/);
  assert.match(runtime, /activelyIngesting: false/);
  assert.match(loop, /transportConnectionAllowed: false/);
  assert.match(entry, /does not claim live monitoring/);
  assert.doesNotMatch(entry, /api\.x\.com|jetstream|WebSocket\(/);
  assert.doesNotMatch(loop, /fetch\(|WebSocket\(|https\.request/);
  assert.match(desk, /deskSourcesLabel \?\? 'Manual only'/);
  assert.match(desk, /transportAllowed: false/);
});

test('worker is bundled for the production image without replacing web start', () => {
  assert.match(pkg, /ops:bundle:publication-db/);
  assert.match(pkg, /worker\/newsroom-worker\.ts/);
  assert.match(pkg, /worker:newsroom/);
  assert.match(dockerfile, /newsroom worker/);
  assert.match(dockerfile, /never the worker/);
  assert.match(dockerfile, /CMD \["node", "server\.js"\]/);
});
