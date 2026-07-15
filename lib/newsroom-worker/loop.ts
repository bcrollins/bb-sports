/**
 * Newsroom worker control loop.
 *
 * Owns lease heartbeats and health state for an always-on process. It does not
 * open provider transports — static preflight still reports connectionAllowed
 * false, and the tick decision refuses live ingest until that contract changes
 * with dedicated transport work and commercial activation.
 */

import { ensureBootstrapped } from '../db/bootstrap';
import { dbAvailable } from '../db/client';
import {
  acquireProviderLease,
  getProviderActivationSnapshots,
  listNewsProviders,
  releaseProviderLease,
} from '../newsroom-provider-queries';
import type { NewsroomProviderKey } from '../newsroom-providers';
import {
  BoundedWorkQueue,
  buildWorkerHealthSnapshot,
  buildWorkerOwnerId,
  calculateWorkerBackoff,
  decideWorkerTickAction,
  WORKER_DEFAULT_TICK_MS,
  WORKER_IDLE_HEARTBEAT_MS,
  WORKER_LEASE_TTL_MS,
  type WorkerHealthSnapshot,
  type WorkerProviderStatus,
  type WorkerRunMode,
} from './runtime';

export type NewsroomWorkerOptions = Readonly<{
  ownerId?: string;
  queueCapacity?: number;
  tickMs?: number;
  env?: NodeJS.ProcessEnv;
  /** Injected for tests; production uses setTimeout. */
  sleep?: (ms: number) => Promise<void>;
  /** Injected for tests to stop after N ticks. */
  shouldContinue?: (tick: number) => boolean;
  onStatus?: (snapshot: WorkerHealthSnapshot) => void;
}>;

export type NewsroomWorkerHandle = Readonly<{
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getHealth: () => WorkerHealthSnapshot;
}>;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function createNewsroomWorker(options: NewsroomWorkerOptions = {}): NewsroomWorkerHandle {
  const env = options.env ?? process.env;
  const ownerId = options.ownerId ?? buildWorkerOwnerId(env);
  const queue = new BoundedWorkQueue<unknown>(options.queueCapacity);
  const sleep = options.sleep ?? defaultSleep;
  const startedAt = new Date();
  const commit = env.RAILWAY_GIT_COMMIT_SHA || env.GIT_COMMIT || null;

  let mode: WorkerRunMode = 'idle';
  let tick = 0;
  let shuttingDown = false;
  let running: Promise<void> | null = null;
  const heldLeases = new Map<string, number>();

  function providerStatuses(enabledKeys: readonly string[]): WorkerProviderStatus[] {
    return enabledKeys.map((providerKey) =>
      Object.freeze({
        providerKey,
        leaseHeld: heldLeases.has(providerKey),
        fenceToken: heldLeases.get(providerKey) ?? null,
        transportAllowed: false as const,
        lastError: heldLeases.has(providerKey)
          ? 'transport_not_connected_preflight_blocked'
          : null,
        lastSuccessAt: null,
      }),
    );
  }

  function snapshot(enabledKeys: readonly string[] = [...heldLeases.keys()]): WorkerHealthSnapshot {
    return buildWorkerHealthSnapshot({
      mode,
      ownerId,
      startedAt,
      tick,
      queueDepth: queue.size,
      queueCapacity: queue.capacity,
      providers: providerStatuses(enabledKeys),
      commit,
    });
  }

  async function releaseAllLeases(): Promise<void> {
    for (const [providerKey, fenceToken] of heldLeases.entries()) {
      try {
        await releaseProviderLease({ providerKey, ownerId, fenceToken });
      } catch {
        // Best-effort release on shutdown.
      }
    }
    heldLeases.clear();
  }

  async function maintainDarkLeases(providerKeys: readonly string[]): Promise<void> {
    for (const providerKey of providerKeys) {
      try {
        const result = await acquireProviderLease({
          providerKey,
          ownerId,
          ttlMs: WORKER_LEASE_TTL_MS,
          offeredFenceToken: heldLeases.get(providerKey) ?? null,
          metadata: {
            role: 'newsroom-worker',
            transport: 'none',
            note: 'Lease held for singleton ownership; transport remains blocked by preflight.',
          },
        });
        if (result.status === 'acquired' || result.status === 'renewed') {
          heldLeases.set(providerKey, result.lease.fenceToken);
        } else {
          heldLeases.delete(providerKey);
        }
      } catch {
        heldLeases.delete(providerKey);
      }
    }
  }

  async function runLoop(): Promise<void> {
    if (!dbAvailable) {
      mode = 'stopped';
      options.onStatus?.(snapshot());
      throw new Error('DATABASE_URL is required for the newsroom worker.');
    }

    await ensureBootstrapped();
    mode = 'idle';

    while (!shuttingDown && (options.shouldContinue?.(tick) ?? true)) {
      tick += 1;
      const providers = await listNewsProviders();
      const activations = await getProviderActivationSnapshots(env);
      const enabledKeys = activations
        .filter((item) => item.configEnabled && item.commercialStatus === 'approved')
        .map((item) => item.providerKey as NewsroomProviderKey);

      // Even when config+commercial are green, static preflight keeps transport
      // blocked until dedicated transport + compliance work lands.
      const decision = decideWorkerTickAction({
        shuttingDown,
        queueDepth: queue.size,
        enabledProviderKeys: enabledKeys,
        transportConnectionAllowed: false,
      });

      if (decision.action === 'drain_and_stop') {
        mode = 'draining';
        queue.clear();
        await releaseAllLeases();
        mode = 'stopped';
        options.onStatus?.(snapshot(enabledKeys));
        break;
      }

      if (decision.action === 'maintain_leases') {
        mode = 'leased';
        await maintainDarkLeases(decision.providerKeys);
      } else {
        // Idle path: do not hold leases for dark providers.
        if (heldLeases.size > 0) {
          await releaseAllLeases();
        }
        mode = 'idle';
      }

      // Touch provider list so cold schemas and seed rows stay warm.
      void providers.length;

      const health = snapshot(enabledKeys);
      options.onStatus?.(health);

      const backoff = calculateWorkerBackoff({
        kind: 'idle',
        attempt: 0,
      });
      const waitMs =
        decision.action === 'idle_wait' && decision.reason === 'no_enabled_providers'
          ? WORKER_IDLE_HEARTBEAT_MS
          : options.tickMs ?? backoff.delayMs ?? WORKER_DEFAULT_TICK_MS;
      await sleep(waitMs);
    }

    if (shuttingDown) {
      mode = 'draining';
      queue.clear();
      await releaseAllLeases();
      mode = 'stopped';
      options.onStatus?.(snapshot());
    }
  }

  return {
    start: async () => {
      if (running) return running;
      shuttingDown = false;
      running = runLoop().finally(() => {
        running = null;
      });
      return running;
    },
    stop: async () => {
      shuttingDown = true;
      if (running) await running;
      else {
        mode = 'draining';
        await releaseAllLeases();
        mode = 'stopped';
      }
    },
    getHealth: () => snapshot(),
  };
}
