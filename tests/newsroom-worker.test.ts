import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BoundedWorkQueue,
  buildWorkerHealthSnapshot,
  buildWorkerOwnerId,
  calculateWorkerBackoff,
  decideWorkerTickAction,
} from '../lib/newsroom-worker/runtime';

test('bounded queue enforces backpressure', () => {
  const queue = new BoundedWorkQueue<number>(2);
  assert.equal(queue.tryPush(1), true);
  assert.equal(queue.tryPush(2), true);
  assert.equal(queue.tryPush(3), false);
  assert.equal(queue.size, 2);
  assert.equal(queue.pop(), 1);
  assert.equal(queue.tryPush(3), true);
});

test('backoff respects rate-limit Retry-After and caps', () => {
  const rate = calculateWorkerBackoff({
    kind: 'rate_limit',
    attempt: 0,
    retryAfterMs: 12_000,
  });
  assert.equal(rate.delayMs, 12_000);

  const capped = calculateWorkerBackoff({
    kind: 'rate_limit',
    attempt: 0,
    retryAfterMs: 60 * 60_000,
  });
  assert.equal(capped.delayMs, 15 * 60_000);

  const network = calculateWorkerBackoff({
    kind: 'network',
    attempt: 0,
    random: () => 0.5,
  });
  assert.ok(network.delayMs >= 250);
  assert.ok(network.delayMs <= 16_000);
});

test('tick decision never selects transport while connectionAllowed is false', () => {
  assert.deepEqual(
    decideWorkerTickAction({
      shuttingDown: true,
      queueDepth: 0,
      enabledProviderKeys: ['x_filtered_stream'],
      transportConnectionAllowed: false,
    }),
    { action: 'drain_and_stop' },
  );

  assert.deepEqual(
    decideWorkerTickAction({
      shuttingDown: false,
      queueDepth: 0,
      enabledProviderKeys: [],
      transportConnectionAllowed: false,
    }),
    { action: 'idle_wait', reason: 'no_enabled_providers' },
  );

  assert.deepEqual(
    decideWorkerTickAction({
      shuttingDown: false,
      queueDepth: 0,
      enabledProviderKeys: ['x_filtered_stream'],
      transportConnectionAllowed: false,
    }),
    { action: 'idle_wait', reason: 'transport_blocked' },
  );
});

test('health snapshot never claims active ingest from the skeleton', () => {
  const snapshot = buildWorkerHealthSnapshot({
    mode: 'idle',
    ownerId: 'newsroom-worker:test:1',
    startedAt: new Date('2026-07-15T00:00:00.000Z'),
    tick: 1,
    queueDepth: 0,
    queueCapacity: 256,
    providers: [],
    commit: 'a'.repeat(40),
  });
  assert.equal(snapshot.activelyIngesting, false);
  assert.equal(snapshot.service, 'bb-sports-newsroom-worker');
  assert.equal(snapshot.ready, true);
  assert.match(buildWorkerOwnerId({ HOSTNAME: 'box', RAILWAY_REPLICA_ID: 'r1' }), /newsroom-worker:r1:/);
});
