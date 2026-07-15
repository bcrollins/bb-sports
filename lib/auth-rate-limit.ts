/**
 * Durable auth attempt rate limiting for gate + admin login.
 *
 * Identity keys are privacy-safe SHA-256 digests (never raw passwords, and
 * never raw IPs in the ledger). Postgres is the shared store across Railway
 * instances; when DATABASE_URL is unavailable we fall back to process memory
 * so local/dev still fails closed on abuse.
 */
import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from './db/client';
import { ensureBootstrapped } from './db/bootstrap';

export type AuthRatePurpose = 'gate' | 'admin_login' | 'comment';

export type AuthRatePolicy = Readonly<{
  maxFailures: number;
  windowMs: number;
  lockMs: number;
}>;

export const AUTH_RATE_POLICIES: Record<AuthRatePurpose, AuthRatePolicy> = {
  gate: {
    maxFailures: 8,
    windowMs: 15 * 60_000,
    lockMs: 15 * 60_000,
  },
  admin_login: {
    maxFailures: 5,
    windowMs: 15 * 60_000,
    lockMs: 30 * 60_000,
  },
  /** Comment abuse: 5 posts / 10 minutes, then 10 minute lock. */
  comment: {
    maxFailures: 5,
    windowMs: 10 * 60_000,
    lockMs: 10 * 60_000,
  },
};

export type AuthAttemptState = {
  failures: number;
  windowStartMs: number;
  lockedUntilMs: number | null;
};

export type AuthRateDecision = {
  allowed: boolean;
  retryAfterSec: number;
  failures: number;
  locked: boolean;
};

const memoryLedger = new Map<string, AuthAttemptState>();

function digest(parts: string[]): string {
  return createHash('sha256').update(parts.filter(Boolean).join('|')).digest('hex');
}

/** Privacy-safe key: purpose + IP prefix hash (+ optional account hash). */
export function buildAuthIdentityKey(input: {
  purpose: AuthRatePurpose;
  ip: string;
  account?: string | null;
}): string {
  const ipNorm = (input.ip || 'unknown').trim().toLowerCase();
  // Use first 3 IPv4 octets or full v6 truncated to /48-ish by first 4 groups.
  const ipPrefix = ipNorm.includes(':')
    ? ipNorm.split(':').slice(0, 4).join(':')
    : ipNorm.split('.').slice(0, 3).join('.');
  const account = (input.account ?? '').trim().toLowerCase();
  return digest([input.purpose, ipPrefix, account ? digest([account]) : 'anon']);
}

export function evaluateAuthAttempt(
  state: AuthAttemptState | null,
  policy: AuthRatePolicy,
  nowMs: number,
): AuthRateDecision {
  if (state?.lockedUntilMs && state.lockedUntilMs > nowMs) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((state.lockedUntilMs - nowMs) / 1000)),
      failures: state.failures,
      locked: true,
    };
  }
  if (!state || nowMs - state.windowStartMs >= policy.windowMs) {
    return { allowed: true, retryAfterSec: 0, failures: 0, locked: false };
  }
  if (state.failures >= policy.maxFailures) {
    const lockUntil = state.lockedUntilMs && state.lockedUntilMs > nowMs
      ? state.lockedUntilMs
      : state.windowStartMs + policy.lockMs;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((lockUntil - nowMs) / 1000)),
      failures: state.failures,
      locked: true,
    };
  }
  return { allowed: true, retryAfterSec: 0, failures: state.failures, locked: false };
}

export function nextFailureState(
  state: AuthAttemptState | null,
  policy: AuthRatePolicy,
  nowMs: number,
): AuthAttemptState {
  const windowFresh = !state || nowMs - state.windowStartMs >= policy.windowMs;
  const base: AuthAttemptState = windowFresh
    ? { failures: 0, windowStartMs: nowMs, lockedUntilMs: null }
    : {
        failures: state.failures,
        windowStartMs: state.windowStartMs,
        lockedUntilMs: state.lockedUntilMs && state.lockedUntilMs > nowMs ? state.lockedUntilMs : null,
      };
  const failures = base.failures + 1;
  const lockedUntilMs =
    failures >= policy.maxFailures ? nowMs + policy.lockMs : base.lockedUntilMs;
  return {
    failures,
    windowStartMs: base.windowStartMs,
    lockedUntilMs,
  };
}

async function readState(purpose: AuthRatePurpose, identityHash: string): Promise<AuthAttemptState | null> {
  if (!dbAvailable || !db) {
    return memoryLedger.get(`${purpose}:${identityHash}`) ?? null;
  }
  await ensureBootstrapped();
  const rows = await db.execute(sql`
    SELECT failures, window_start, locked_until
    FROM auth_attempts
    WHERE purpose = ${purpose} AND identity_hash = ${identityHash}
    LIMIT 1
  `);
  const row = (rows as unknown as Array<{
    failures: number;
    window_start: Date | string;
    locked_until: Date | string | null;
  }>)[0];
  if (!row) return null;
  return {
    failures: Number(row.failures) || 0,
    windowStartMs: new Date(row.window_start).getTime(),
    lockedUntilMs: row.locked_until ? new Date(row.locked_until).getTime() : null,
  };
}

async function writeState(
  purpose: AuthRatePurpose,
  identityHash: string,
  state: AuthAttemptState,
): Promise<void> {
  if (!dbAvailable || !db) {
    memoryLedger.set(`${purpose}:${identityHash}`, state);
    return;
  }
  await ensureBootstrapped();
  const windowStart = new Date(state.windowStartMs).toISOString();
  if (state.lockedUntilMs) {
    const lockedUntil = new Date(state.lockedUntilMs).toISOString();
    await db.execute(sql`
      INSERT INTO auth_attempts (purpose, identity_hash, window_start, failures, locked_until, updated_at)
      VALUES (${purpose}, ${identityHash}, ${windowStart}::timestamptz, ${state.failures}, ${lockedUntil}::timestamptz, now())
      ON CONFLICT (purpose, identity_hash) DO UPDATE SET
        window_start = EXCLUDED.window_start,
        failures = EXCLUDED.failures,
        locked_until = EXCLUDED.locked_until,
        updated_at = now()
    `);
    return;
  }
  await db.execute(sql`
    INSERT INTO auth_attempts (purpose, identity_hash, window_start, failures, locked_until, updated_at)
    VALUES (${purpose}, ${identityHash}, ${windowStart}::timestamptz, ${state.failures}, NULL, now())
    ON CONFLICT (purpose, identity_hash) DO UPDATE SET
      window_start = EXCLUDED.window_start,
      failures = EXCLUDED.failures,
      locked_until = NULL,
      updated_at = now()
  `);
}

async function clearState(purpose: AuthRatePurpose, identityHash: string): Promise<void> {
  if (!dbAvailable || !db) {
    memoryLedger.delete(`${purpose}:${identityHash}`);
    return;
  }
  await ensureBootstrapped();
  await db.execute(sql`
    DELETE FROM auth_attempts
    WHERE purpose = ${purpose} AND identity_hash = ${identityHash}
  `);
}

export async function assertAuthAttemptAllowed(input: {
  purpose: AuthRatePurpose;
  ip: string;
  account?: string | null;
  nowMs?: number;
}): Promise<AuthRateDecision> {
  const policy = AUTH_RATE_POLICIES[input.purpose];
  const identityHash = buildAuthIdentityKey(input);
  const nowMs = input.nowMs ?? Date.now();
  const state = await readState(input.purpose, identityHash);
  return evaluateAuthAttempt(state, policy, nowMs);
}

export async function recordAuthFailure(input: {
  purpose: AuthRatePurpose;
  ip: string;
  account?: string | null;
  nowMs?: number;
}): Promise<AuthRateDecision> {
  const policy = AUTH_RATE_POLICIES[input.purpose];
  const identityHash = buildAuthIdentityKey(input);
  const nowMs = input.nowMs ?? Date.now();
  const prev = await readState(input.purpose, identityHash);
  const next = nextFailureState(prev, policy, nowMs);
  await writeState(input.purpose, identityHash, next);
  return evaluateAuthAttempt(next, policy, nowMs);
}

export async function recordAuthSuccess(input: {
  purpose: AuthRatePurpose;
  ip: string;
  account?: string | null;
}): Promise<void> {
  const identityHash = buildAuthIdentityKey(input);
  await clearState(input.purpose, identityHash);
}

/** Test-only helper to reset process memory ledger. */
export function __resetAuthRateLimitMemoryForTests(): void {
  memoryLedger.clear();
}
