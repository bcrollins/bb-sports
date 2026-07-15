/**
 * Durable provider governance operations: leases with fencing tokens,
 * checkpoints, ingest attempts, and dead letters.
 *
 * No network transport lives here. Callers must already hold editorial or
 * worker authority; these helpers only enforce lease fencing and append-only
 * operational history.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from './db/client';
import { ensureBootstrapped } from './db/bootstrap';
import {
  newsProviderCheckpoints,
  newsProviderDeadLetters,
  newsProviderIngestAttempts,
  newsProviderLeases,
  newsProviders,
  type NewsProvider,
  type NewsProviderCheckpoint,
  type NewsProviderDeadLetter,
  type NewsProviderIngestAttempt,
  type NewsProviderLease,
} from './db/schema';
import {
  canWriteWithFence,
  decideProviderLeaseAction,
  DEFAULT_PROVIDER_LEASE_TTL_MS,
  leaseExpiryFrom,
  type ProviderLeaseRecord,
} from './newsroom-provider-leases';
import {
  createProviderPayloadHash,
  evaluateProviderActivation,
  isNewsroomProviderKey,
  NEWSROOM_INGEST_ATTEMPT_KINDS,
  NEWSROOM_INGEST_OUTCOMES,
  NEWSROOM_PROVIDER_CATALOG,
  readCredentialPresence,
  type NewsroomIngestAttemptKind,
  type NewsroomIngestOutcome,
  type NewsroomProviderKey,
  type ProviderActivationSnapshot,
} from './newsroom-providers';

export type ProviderQueryErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FENCE_REJECTED'
  | 'DB_UNAVAILABLE';

export class ProviderQueryError extends Error {
  constructor(
    public readonly code: ProviderQueryErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProviderQueryError';
  }
}

function requireDb() {
  if (!db) {
    throw new ProviderQueryError('DB_UNAVAILABLE', 503, 'Database is not configured.');
  }
  return db;
}

function assertProviderKey(value: string): NewsroomProviderKey {
  if (!isNewsroomProviderKey(value)) {
    throw new ProviderQueryError('VALIDATION', 400, `Unknown newsroom provider: ${value}`);
  }
  return value;
}

function toLeaseRecord(row: NewsProviderLease): ProviderLeaseRecord {
  return {
    providerKey: row.providerKey,
    ownerId: row.ownerId,
    fenceToken: row.fenceToken,
    acquiredAt: row.acquiredAt,
    renewedAt: row.renewedAt,
    expiresAt: row.expiresAt,
    heartbeatAt: row.heartbeatAt,
  };
}

export async function listNewsProviders(): Promise<NewsProvider[]> {
  await ensureBootstrapped();
  const database = requireDb();
  return database.select().from(newsProviders).orderBy(newsProviders.providerKey);
}

export async function getNewsProvider(providerKey: string): Promise<NewsProvider | null> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(providerKey);
  const rows = await database
    .select()
    .from(newsProviders)
    .where(eq(newsProviders.providerKey, key))
    .limit(1);
  return rows[0] ?? null;
}

export async function refreshProviderCredentialPresence(
  providerKey: string,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<NewsProvider> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(providerKey);
  const presence = readCredentialPresence(key, environment);
  const entry = NEWSROOM_PROVIDER_CATALOG[key];
  const now = new Date();
  const updated = await database
    .update(newsProviders)
    .set({
      credentialPresence: presence,
      credentialEnvNames: [...entry.credentialEnvNames],
      updatedAt: now,
    })
    .where(eq(newsProviders.providerKey, key))
    .returning();
  if (!updated[0]) {
    throw new ProviderQueryError('NOT_FOUND', 404, `Provider ${key} is not registered.`);
  }
  return updated[0];
}

export async function getProviderActivationSnapshots(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<ProviderActivationSnapshot[]> {
  const providers = await listNewsProviders();
  const leases = await listProviderLeases();
  const leaseByKey = new Map(leases.map((lease) => [lease.providerKey, lease]));
  const now = new Date();

  return providers.map((provider) => {
    const key = assertProviderKey(provider.providerKey);
    const lease = leaseByKey.get(provider.providerKey);
    const leaseHeld = Boolean(lease && lease.expiresAt.getTime() > now.getTime());
    return evaluateProviderActivation({
      providerKey: key,
      configEnabled: provider.configEnabled,
      commercialStatus: provider.commercialStatus as 'approved' | 'review_required' | 'prohibited' | 'enterprise',
      environment,
      runtime: {
        leaseHeld,
        // Interval 1 has no worker success path. recentSuccess stays false so
        // operationalLabel cannot become "live" from configuration alone.
        recentSuccess: false,
        degraded: provider.consecutiveFailures > 0 && leaseHeld,
      },
    });
  });
}

export async function listProviderLeases(): Promise<NewsProviderLease[]> {
  await ensureBootstrapped();
  const database = requireDb();
  return database.select().from(newsProviderLeases);
}

export async function getProviderLease(
  providerKey: string,
): Promise<NewsProviderLease | null> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(providerKey);
  const rows = await database
    .select()
    .from(newsProviderLeases)
    .where(eq(newsProviderLeases.providerKey, key))
    .limit(1);
  return rows[0] ?? null;
}

export type AcquireProviderLeaseResult =
  | Readonly<{ status: 'acquired' | 'renewed'; lease: NewsProviderLease }>
  | Readonly<{ status: 'rejected'; reason: 'held_by_other' | 'fence_mismatch' | 'expired' }>;

export async function acquireProviderLease(options: Readonly<{
  providerKey: string;
  ownerId: string;
  ttlMs?: number;
  offeredFenceToken?: number | null;
  metadata?: Record<string, unknown>;
}>): Promise<AcquireProviderLeaseResult> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(options.providerKey);
  const ownerId = options.ownerId.trim();
  if (!ownerId || ownerId.length > 160) {
    throw new ProviderQueryError('VALIDATION', 400, 'A nonblank ownerId is required.');
  }

  const provider = await getNewsProvider(key);
  if (!provider) {
    throw new ProviderQueryError('NOT_FOUND', 404, `Provider ${key} is not registered.`);
  }

  return database.transaction(async (tx) => {
    const existingRows = await tx
      .select()
      .from(newsProviderLeases)
      .where(eq(newsProviderLeases.providerKey, key))
      .for('update');
    const existing = existingRows[0] ?? null;
    const now = new Date();
    const decision = decideProviderLeaseAction({
      existing: existing ? toLeaseRecord(existing) : null,
      ownerId,
      offeredFenceToken: options.offeredFenceToken,
      now,
    });

    if (decision.action === 'reject') {
      return { status: 'rejected', reason: decision.reason };
    }

    const expiresAt = leaseExpiryFrom(now, options.ttlMs ?? DEFAULT_PROVIDER_LEASE_TTL_MS);
    const metadata = options.metadata ?? {};

    if (decision.action === 'acquire') {
      const values = {
        providerKey: key,
        ownerId,
        fenceToken: decision.nextFenceToken,
        acquiredAt: now,
        renewedAt: now,
        expiresAt,
        heartbeatAt: now,
        metadata,
      };
      const row = existing
        ? (
            await tx
              .update(newsProviderLeases)
              .set(values)
              .where(eq(newsProviderLeases.providerKey, key))
              .returning()
          )[0]
        : (
            await tx.insert(newsProviderLeases).values(values).returning()
          )[0];
      return { status: 'acquired', lease: row };
    }

    const renewed = (
      await tx
        .update(newsProviderLeases)
        .set({
          renewedAt: now,
          expiresAt,
          heartbeatAt: now,
          metadata,
        })
        .where(
          and(
            eq(newsProviderLeases.providerKey, key),
            eq(newsProviderLeases.ownerId, ownerId),
            eq(newsProviderLeases.fenceToken, decision.fenceToken),
          ),
        )
        .returning()
    )[0];
    if (!renewed) {
      return { status: 'rejected', reason: 'fence_mismatch' };
    }
    return { status: 'renewed', lease: renewed };
  });
}

export async function releaseProviderLease(options: Readonly<{
  providerKey: string;
  ownerId: string;
  fenceToken: number;
}>): Promise<boolean> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(options.providerKey);
  const now = new Date();
  // Soft-release by expiring the lease while preserving the fence history.
  const updated = await database
    .update(newsProviderLeases)
    .set({
      expiresAt: now,
      heartbeatAt: now,
      renewedAt: now,
    })
    .where(
      and(
        eq(newsProviderLeases.providerKey, key),
        eq(newsProviderLeases.ownerId, options.ownerId.trim()),
        eq(newsProviderLeases.fenceToken, options.fenceToken),
      ),
    )
    .returning({ providerKey: newsProviderLeases.providerKey });
  return updated.length > 0;
}

export async function getProviderCheckpoint(
  providerKey: string,
): Promise<NewsProviderCheckpoint | null> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(providerKey);
  const rows = await database
    .select()
    .from(newsProviderCheckpoints)
    .where(eq(newsProviderCheckpoints.providerKey, key))
    .limit(1);
  return rows[0] ?? null;
}

export async function writeProviderCheckpoint(options: Readonly<{
  providerKey: string;
  ownerId: string;
  fenceToken: number;
  cursorValue: string;
  cursorKind?: string;
  lastObservedProviderAt?: Date | null;
  metadata?: Record<string, unknown>;
}>): Promise<NewsProviderCheckpoint> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(options.providerKey);
  const cursorValue = options.cursorValue;
  if (cursorValue.length > 8_192) {
    throw new ProviderQueryError('VALIDATION', 400, 'Checkpoint cursor is too large.');
  }

  return database.transaction(async (tx) => {
    const leaseRows = await tx
      .select()
      .from(newsProviderLeases)
      .where(eq(newsProviderLeases.providerKey, key))
      .for('update');
    const lease = leaseRows[0] ?? null;
    if (
      !canWriteWithFence({
        lease: lease ? toLeaseRecord(lease) : null,
        ownerId: options.ownerId,
        fenceToken: options.fenceToken,
      })
    ) {
      throw new ProviderQueryError(
        'FENCE_REJECTED',
        409,
        'Checkpoint write requires a live lease with a matching fencing token.',
      );
    }

    const provider = (
      await tx
        .select()
        .from(newsProviders)
        .where(eq(newsProviders.providerKey, key))
        .limit(1)
    )[0];
    if (!provider) {
      throw new ProviderQueryError('NOT_FOUND', 404, `Provider ${key} is not registered.`);
    }

    const now = new Date();
    const cursorKind = options.cursorKind ?? provider.cursorKind;
    const existing = (
      await tx
        .select()
        .from(newsProviderCheckpoints)
        .where(eq(newsProviderCheckpoints.providerKey, key))
        .for('update')
    )[0];

    const values = {
      providerKey: key,
      cursorKind,
      cursorValue,
      fenceToken: options.fenceToken,
      lastCommittedAt: now,
      lastObservedProviderAt: options.lastObservedProviderAt ?? null,
      metadata: options.metadata ?? {},
      updatedAt: now,
    };

    if (existing) {
      const updated = (
        await tx
          .update(newsProviderCheckpoints)
          .set(values)
          .where(eq(newsProviderCheckpoints.providerKey, key))
          .returning()
      )[0];
      return updated;
    }
    const inserted = (
      await tx.insert(newsProviderCheckpoints).values(values).returning()
    )[0];
    return inserted;
  });
}

export async function recordProviderIngestAttempt(options: Readonly<{
  providerKey: string;
  attemptKind: NewsroomIngestAttemptKind;
  outcome: NewsroomIngestOutcome;
  startedAt: Date;
  finishedAt?: Date;
  latencyMs?: number | null;
  httpStatus?: number | null;
  retryAfterMs?: number | null;
  fenceToken?: number | null;
  cursorBefore?: string | null;
  cursorAfter?: string | null;
  externalId?: string | null;
  payloadHash?: string | null;
  errorCode?: string | null;
  errorSummary?: string;
  metadata?: Record<string, unknown>;
}>): Promise<NewsProviderIngestAttempt> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(options.providerKey);
  if (!(NEWSROOM_INGEST_ATTEMPT_KINDS as readonly string[]).includes(options.attemptKind)) {
    throw new ProviderQueryError('VALIDATION', 400, 'Invalid ingest attempt kind.');
  }
  if (!(NEWSROOM_INGEST_OUTCOMES as readonly string[]).includes(options.outcome)) {
    throw new ProviderQueryError('VALIDATION', 400, 'Invalid ingest outcome.');
  }

  const finishedAt = options.finishedAt ?? new Date();
  if (finishedAt.getTime() < options.startedAt.getTime()) {
    throw new ProviderQueryError('VALIDATION', 400, 'finishedAt must be at or after startedAt.');
  }

  const latencyMs =
    options.latencyMs ??
    Math.max(0, finishedAt.getTime() - options.startedAt.getTime());

  return database.transaction(async (tx) => {
    const inserted = (
      await tx
        .insert(newsProviderIngestAttempts)
        .values({
          providerKey: key,
          attemptKind: options.attemptKind,
          outcome: options.outcome,
          startedAt: options.startedAt,
          finishedAt,
          latencyMs,
          httpStatus: options.httpStatus ?? null,
          retryAfterMs: options.retryAfterMs ?? null,
          fenceToken: options.fenceToken ?? null,
          cursorBefore: options.cursorBefore ?? null,
          cursorAfter: options.cursorAfter ?? null,
          externalId: options.externalId ?? null,
          payloadHash: options.payloadHash ?? null,
          errorCode: options.errorCode ?? null,
          errorSummary: (options.errorSummary ?? '').slice(0, 2_000),
          metadata: options.metadata ?? {},
        })
        .returning()
    )[0];

    if (options.outcome === 'success') {
      await tx
        .update(newsProviders)
        .set({
          lastSuccessAt: finishedAt,
          consecutiveFailures: 0,
          lastFailureSummary: '',
          updatedAt: finishedAt,
        })
        .where(eq(newsProviders.providerKey, key));
    } else if (
      options.outcome === 'failure' ||
      options.outcome === 'rate_limited' ||
      options.outcome === 'dead_lettered'
    ) {
      await tx
        .update(newsProviders)
        .set({
          lastFailureAt: finishedAt,
          lastFailureSummary: (options.errorSummary ?? options.outcome).slice(0, 500),
          consecutiveFailures: sql`${newsProviders.consecutiveFailures} + 1`,
          updatedAt: finishedAt,
        })
        .where(eq(newsProviders.providerKey, key));
    }

    return inserted;
  });
}

export async function recordProviderDeadLetter(options: Readonly<{
  providerKey: string;
  reason: string;
  externalId?: string | null;
  payloadHash?: string | null;
  observedAt?: Date;
  errorSummary?: string;
  rawProvenance?: Record<string, unknown>;
  ingestAttemptId?: string | null;
}>): Promise<NewsProviderDeadLetter> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(options.providerKey);
  const reason = options.reason.trim();
  if (!reason || reason.length > 80) {
    throw new ProviderQueryError('VALIDATION', 400, 'A nonblank dead-letter reason is required.');
  }

  // Bound provenance: reject accidental secret-looking keys.
  const provenance = options.rawProvenance ?? {};
  for (const prop of Object.keys(provenance)) {
    if (/token|secret|password|authorization|bearer|cookie/i.test(prop)) {
      throw new ProviderQueryError(
        'VALIDATION',
        400,
        'Dead-letter provenance must not include secret-bearing keys.',
      );
    }
  }

  const inserted = await database
    .insert(newsProviderDeadLetters)
    .values({
      providerKey: key,
      reason,
      externalId: options.externalId ?? null,
      payloadHash: options.payloadHash ?? null,
      observedAt: options.observedAt ?? new Date(),
      errorSummary: (options.errorSummary ?? '').slice(0, 2_000),
      rawProvenance: provenance,
      ingestAttemptId: options.ingestAttemptId ?? null,
    })
    .returning();
  return inserted[0];
}

export async function resolveProviderDeadLetter(options: Readonly<{
  id: string;
  resolutionSummary: string;
}>): Promise<NewsProviderDeadLetter> {
  await ensureBootstrapped();
  const database = requireDb();
  const summary = options.resolutionSummary.trim();
  if (summary.length < 8) {
    throw new ProviderQueryError(
      'VALIDATION',
      400,
      'Resolution summary must be at least 8 characters.',
    );
  }

  const updated = await database
    .update(newsProviderDeadLetters)
    .set({
      resolvedAt: new Date(),
      resolutionSummary: summary.slice(0, 2_000),
    })
    .where(
      and(
        eq(newsProviderDeadLetters.id, options.id),
        isNull(newsProviderDeadLetters.resolvedAt),
      ),
    )
    .returning();

  if (!updated[0]) {
    throw new ProviderQueryError(
      'CONFLICT',
      409,
      'Dead letter was not found or is already resolved.',
    );
  }
  return updated[0];
}

export async function listOpenProviderDeadLetters(
  providerKey?: string,
  limit = 50,
): Promise<NewsProviderDeadLetter[]> {
  await ensureBootstrapped();
  const database = requireDb();
  const capped = Math.min(Math.max(limit, 1), 200);
  if (providerKey) {
    const key = assertProviderKey(providerKey);
    return database
      .select()
      .from(newsProviderDeadLetters)
      .where(
        and(
          eq(newsProviderDeadLetters.providerKey, key),
          isNull(newsProviderDeadLetters.resolvedAt),
        ),
      )
      .orderBy(desc(newsProviderDeadLetters.createdAt))
      .limit(capped);
  }
  return database
    .select()
    .from(newsProviderDeadLetters)
    .where(isNull(newsProviderDeadLetters.resolvedAt))
    .orderBy(desc(newsProviderDeadLetters.createdAt))
    .limit(capped);
}

export async function listRecentProviderIngestAttempts(
  providerKey: string,
  limit = 50,
): Promise<NewsProviderIngestAttempt[]> {
  await ensureBootstrapped();
  const database = requireDb();
  const key = assertProviderKey(providerKey);
  const capped = Math.min(Math.max(limit, 1), 200);
  return database
    .select()
    .from(newsProviderIngestAttempts)
    .where(eq(newsProviderIngestAttempts.providerKey, key))
    .orderBy(desc(newsProviderIngestAttempts.createdAt))
    .limit(capped);
}

/** Pure helper re-export for callers building idempotent external identities. */
export { createProviderPayloadHash };
