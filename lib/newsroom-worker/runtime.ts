/**
 * Pure newsroom worker runtime helpers.
 *
 * No network I/O lives here. The entrypoint owns process lifecycle, leases,
 * and (later) provider transports. This module encodes backoff, queue bounds,
 * shutdown, and status labeling so those rules are unit-testable.
 */

export const WORKER_DEFAULT_TICK_MS = 2_000;
export const WORKER_MAX_TICK_MS = 60_000;
export const WORKER_DEFAULT_QUEUE_CAPACITY = 256;
export const WORKER_MAX_QUEUE_CAPACITY = 2_000;
export const WORKER_LEASE_TTL_MS = 30_000;
export const WORKER_IDLE_HEARTBEAT_MS = 15_000;

export type WorkerRunMode = 'idle' | 'leased' | 'draining' | 'stopped';

export type WorkerProviderStatus = Readonly<{
  providerKey: string;
  leaseHeld: boolean;
  fenceToken: number | null;
  transportAllowed: false;
  lastError: string | null;
  lastSuccessAt: string | null;
}>;

export type WorkerHealthSnapshot = Readonly<{
  service: 'bb-sports-newsroom-worker';
  status: 'ok' | 'draining' | 'stopped';
  ready: boolean;
  mode: WorkerRunMode;
  ownerId: string;
  startedAt: string;
  tick: number;
  queueDepth: number;
  queueCapacity: number;
  providers: readonly WorkerProviderStatus[];
  /** Always false until a transport proves live ingest outside this skeleton. */
  activelyIngesting: false;
  commit: string | null;
}>;

export type BackoffPlan = Readonly<{
  delayMs: number;
  attempt: number;
  kind: 'network' | 'http' | 'rate_limit' | 'idle';
}>;

export function normalizeQueueCapacity(value: number | undefined): number {
  if (!Number.isFinite(value) || value === undefined) return WORKER_DEFAULT_QUEUE_CAPACITY;
  if (value < 1) return 1;
  return Math.min(Math.floor(value), WORKER_MAX_QUEUE_CAPACITY);
}

/**
 * Bounded exponential backoff with full jitter.
 * rate_limit honors Retry-After when provided and caps at 15 minutes.
 */
export function calculateWorkerBackoff(options: Readonly<{
  kind: 'network' | 'http' | 'rate_limit' | 'idle';
  attempt: number;
  retryAfterMs?: number | null;
  random?: () => number;
}>): BackoffPlan {
  const attempt = Math.max(0, Math.floor(options.attempt));
  const random = options.random ?? Math.random;

  if (options.kind === 'idle') {
    return Object.freeze({ delayMs: WORKER_DEFAULT_TICK_MS, attempt, kind: 'idle' });
  }

  if (options.kind === 'rate_limit') {
    const retryAfter = options.retryAfterMs;
    if (typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0) {
      return Object.freeze({
        delayMs: Math.min(Math.floor(retryAfter), 15 * 60_000),
        attempt,
        kind: 'rate_limit',
      });
    }
  }

  const base =
    options.kind === 'network' ? 1_000 : options.kind === 'http' ? 5_000 : 10_000;
  const cap =
    options.kind === 'network' ? 16_000 : options.kind === 'http' ? 320_000 : 15 * 60_000;
  const exp = Math.min(cap, base * 2 ** Math.min(attempt, 10));
  const delayMs = Math.max(250, Math.floor(random() * exp));
  return Object.freeze({ delayMs, attempt, kind: options.kind });
}

export class BoundedWorkQueue<T> {
  private readonly items: T[] = [];
  readonly capacity: number;

  constructor(capacity = WORKER_DEFAULT_QUEUE_CAPACITY) {
    this.capacity = normalizeQueueCapacity(capacity);
  }

  get size(): number {
    return this.items.length;
  }

  get isFull(): boolean {
    return this.items.length >= this.capacity;
  }

  /** Returns false when backpressure rejects the push. */
  tryPush(item: T): boolean {
    if (this.isFull) return false;
    this.items.push(item);
    return true;
  }

  pop(): T | undefined {
    return this.items.shift();
  }

  clear(): void {
    this.items.length = 0;
  }
}

export function buildWorkerOwnerId(env: Readonly<Record<string, string | undefined>> = process.env): string {
  const replica =
    env.RAILWAY_REPLICA_ID ||
    env.RAILWAY_DEPLOYMENT_ID ||
    env.HOSTNAME ||
    'local';
  const pid = typeof process !== 'undefined' ? String(process.pid) : '0';
  return `newsroom-worker:${replica}:${pid}`.slice(0, 160);
}

export function buildWorkerHealthSnapshot(options: Readonly<{
  mode: WorkerRunMode;
  ownerId: string;
  startedAt: Date;
  tick: number;
  queueDepth: number;
  queueCapacity: number;
  providers: readonly WorkerProviderStatus[];
  commit?: string | null;
}>): WorkerHealthSnapshot {
  const status =
    options.mode === 'stopped' ? 'stopped' : options.mode === 'draining' ? 'draining' : 'ok';
  const ready = options.mode === 'idle' || options.mode === 'leased';
  return Object.freeze({
    service: 'bb-sports-newsroom-worker',
    status,
    ready,
    mode: options.mode,
    ownerId: options.ownerId,
    startedAt: options.startedAt.toISOString(),
    tick: options.tick,
    queueDepth: options.queueDepth,
    queueCapacity: options.queueCapacity,
    providers: Object.freeze([...options.providers]),
    activelyIngesting: false,
    commit: options.commit ?? null,
  });
}

/**
 * Decide the next worker action for a tick. Transport is never selected while
 * connectionAllowed remains false (current static preflight contract).
 */
export function decideWorkerTickAction(options: Readonly<{
  shuttingDown: boolean;
  queueDepth: number;
  enabledProviderKeys: readonly string[];
  transportConnectionAllowed: false;
}>): Readonly<
  | { action: 'drain_and_stop' }
  | { action: 'idle_wait'; reason: 'no_enabled_providers' | 'transport_blocked' | 'backpressure' }
  | { action: 'maintain_leases'; providerKeys: readonly string[] }
> {
  if (options.shuttingDown) {
    return Object.freeze({ action: 'drain_and_stop' });
  }
  if (options.queueDepth > 0 && options.enabledProviderKeys.length === 0) {
    return Object.freeze({ action: 'idle_wait', reason: 'backpressure' });
  }
  if (options.enabledProviderKeys.length === 0) {
    return Object.freeze({ action: 'idle_wait', reason: 'no_enabled_providers' });
  }
  // connectionAllowed is typed false on purpose for the skeleton/preflight era.
  if (options.transportConnectionAllowed === false) {
    return Object.freeze({ action: 'idle_wait', reason: 'transport_blocked' });
  }
  return Object.freeze({
    action: 'maintain_leases',
    providerKeys: Object.freeze([...options.enabledProviderKeys]),
  });
}
