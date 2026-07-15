/**
 * Pure lease/fencing helpers for newsroom provider workers.
 * Database application lives in newsroom-provider-queries.ts.
 */

export const DEFAULT_PROVIDER_LEASE_TTL_MS = 30_000;
export const MIN_PROVIDER_LEASE_TTL_MS = 5_000;
export const MAX_PROVIDER_LEASE_TTL_MS = 120_000;
export const PROVIDER_LEASE_RENEW_SKEW_MS = 5_000;

export type ProviderLeaseRecord = Readonly<{
  providerKey: string;
  ownerId: string;
  fenceToken: number;
  acquiredAt: Date;
  renewedAt: Date;
  expiresAt: Date;
  heartbeatAt: Date;
}>;

export type LeaseDecision =
  | Readonly<{ action: 'acquire'; nextFenceToken: number }>
  | Readonly<{ action: 'renew'; fenceToken: number }>
  | Readonly<{ action: 'reject'; reason: 'held_by_other' | 'fence_mismatch' | 'expired' }>;

export function normalizeProviderLeaseTtlMs(ttlMs: number): number {
  if (!Number.isFinite(ttlMs) || ttlMs < MIN_PROVIDER_LEASE_TTL_MS) {
    return MIN_PROVIDER_LEASE_TTL_MS;
  }
  if (ttlMs > MAX_PROVIDER_LEASE_TTL_MS) return MAX_PROVIDER_LEASE_TTL_MS;
  return Math.floor(ttlMs);
}

export function isProviderLeaseExpired(
  lease: Readonly<{ expiresAt: Date }>,
  now: Date = new Date(),
): boolean {
  return lease.expiresAt.getTime() <= now.getTime();
}

/**
 * Decide whether a worker may take or renew a provider lease.
 * Fencing tokens only increase on a true acquire (including after expiry).
 */
export function decideProviderLeaseAction(options: Readonly<{
  existing: ProviderLeaseRecord | null;
  ownerId: string;
  offeredFenceToken?: number | null;
  now?: Date;
}>): LeaseDecision {
  const now = options.now ?? new Date();
  const ownerId = options.ownerId.trim();
  if (!ownerId) {
    return Object.freeze({ action: 'reject', reason: 'fence_mismatch' });
  }

  if (!options.existing || isProviderLeaseExpired(options.existing, now)) {
    const previousFence = options.existing?.fenceToken ?? 0;
    return Object.freeze({
      action: 'acquire',
      nextFenceToken: previousFence + 1,
    });
  }

  if (options.existing.ownerId !== ownerId) {
    return Object.freeze({ action: 'reject', reason: 'held_by_other' });
  }

  if (
    options.offeredFenceToken != null &&
    options.offeredFenceToken !== options.existing.fenceToken
  ) {
    return Object.freeze({ action: 'reject', reason: 'fence_mismatch' });
  }

  return Object.freeze({
    action: 'renew',
    fenceToken: options.existing.fenceToken,
  });
}

export function canWriteWithFence(options: Readonly<{
  lease: ProviderLeaseRecord | null;
  ownerId: string;
  fenceToken: number;
  now?: Date;
}>): boolean {
  if (!options.lease) return false;
  if (options.lease.ownerId !== options.ownerId.trim()) return false;
  if (options.lease.fenceToken !== options.fenceToken) return false;
  if (isProviderLeaseExpired(options.lease, options.now)) return false;
  return true;
}

export function leaseExpiryFrom(now: Date, ttlMs: number): Date {
  return new Date(now.getTime() + normalizeProviderLeaseTtlMs(ttlMs));
}
