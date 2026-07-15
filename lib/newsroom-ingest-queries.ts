/**
 * Authoritative provider ingestion transaction.
 *
 * One atomic write path for normalized external candidates:
 *   validate → gate → dedupe → signal + event link + activity → ingest attempt
 *
 * Never verifies events, never publishes articles, never mutates publication
 * state. Transport and activation remain separate fail-closed concerns.
 */

import { and, desc, eq, or } from 'drizzle-orm';
import { db } from './db/client';
import { ensureBootstrapped } from './db/bootstrap';
import {
  newsEventSignals,
  newsEvents,
  newsProviders,
  newsroomActivity,
  newsSignals,
  newsSources,
  type NewsEvent,
  type NewsSignal,
} from './db/schema';
import {
  decideProviderIngestGate,
  normalizeProviderIngestCandidate,
  type NormalizedProviderIngest,
  type ProviderIngestCandidateInput,
} from './newsroom-ingest';
import { recordProviderIngestAttempt } from './newsroom-provider-queries';
import {
  NewsroomError,
  type NewsroomActor,
  type NewsroomActivityFeedItem,
} from './newsroom-queries';
import { z, ZodError } from 'zod';

export type IngestProviderCandidateResult = Readonly<{
  created: boolean;
  deduplicated: boolean;
  signal: NewsSignal;
  event: NewsEvent;
  activity: NewsroomActivityFeedItem;
  normalized: NormalizedProviderIngest;
  ingestAttemptId: string | null;
}>;

const actorSchema = z.object({
  userId: z.string().uuid().nullish(),
  label: z.string().trim().min(2).max(160),
});

type Database = NonNullable<typeof db>;
type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

function parseActor(actor: NewsroomActor): Required<NewsroomActor> {
  try {
    const parsed = actorSchema.parse(actor);
    return { userId: parsed.userId ?? null, label: parsed.label };
  } catch (error) {
    if (error instanceof ZodError) {
      throw new NewsroomError('VALIDATION', 400, error.issues[0]?.message ?? 'Invalid actor.');
    }
    throw error;
  }
}

function requireDatabase(): Database {
  if (!db) {
    throw new NewsroomError('DB_UNAVAILABLE', 503, 'The newsroom database is unavailable.');
  }
  return db;
}

function auditSummary(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

async function appendActivity(
  tx: Tx,
  input: {
    eventId?: string | null;
    signalId?: string | null;
    actor: Required<NewsroomActor>;
    action: string;
    fromState?: string | null;
    toState?: string | null;
    summary: string;
    metadata?: Record<string, unknown>;
  },
): Promise<NewsroomActivityFeedItem> {
  const [activity] = await tx
    .insert(newsroomActivity)
    .values({
      eventId: input.eventId ?? null,
      signalId: input.signalId ?? null,
      actorUserId: input.actor.userId,
      actorLabel: input.actor.label,
      action: input.action,
      fromState: input.fromState ?? null,
      toState: input.toState ?? null,
      summary: auditSummary(input.summary),
      metadata: input.metadata ?? {},
    })
    .returning({
      sequence: newsroomActivity.sequence,
      eventId: newsroomActivity.eventId,
      signalId: newsroomActivity.signalId,
      action: newsroomActivity.action,
      actorLabel: newsroomActivity.actorLabel,
      fromState: newsroomActivity.fromState,
      toState: newsroomActivity.toState,
      summary: newsroomActivity.summary,
      createdAt: newsroomActivity.createdAt,
    });
  if (!activity) {
    throw new NewsroomError('CONFLICT', 409, 'The newsroom activity record could not be created.');
  }
  return activity;
}

function gateToError(reason: string): NewsroomError {
  switch (reason) {
    case 'provider_missing':
      return new NewsroomError('NOT_FOUND', 404, 'Provider is not registered.');
    case 'provider_prohibited':
      return new NewsroomError('VALIDATION', 403, 'Provider is prohibited for commercial use.');
    case 'provider_disabled':
      return new NewsroomError(
        'VALIDATION',
        403,
        'Provider config is disabled; external ingest remains dark.',
      );
    case 'commercial_not_approved':
      return new NewsroomError(
        'VALIDATION',
        403,
        'Provider commercial status is not approved for ingest.',
      );
    case 'source_missing':
      return new NewsroomError('NOT_FOUND', 404, 'Provider intake source is not registered.');
    case 'source_disabled':
      return new NewsroomError('VALIDATION', 403, 'Provider intake source is disabled.');
    case 'source_owner_mismatch':
      return new NewsroomError('VALIDATION', 400, 'Source owner does not match the candidate owner.');
    case 'source_commercial_blocked':
      return new NewsroomError('VALIDATION', 403, 'Source commercial status blocks ingest.');
    default:
      return new NewsroomError('VALIDATION', 400, `Provider ingest rejected: ${reason}`);
  }
}

/**
 * Persist one normalized external candidate atomically.
 *
 * Guarantees:
 * - fails closed when the provider/source gate rejects
 * - exact dedupe on external id, content hash, and URL hash
 * - creates signal + event + activity together for new leads
 * - records a durable ingest attempt (success or duplicate)
 * - never verifies, dismisses, or publishes
 */
export async function ingestProviderCandidate(
  input: ProviderIngestCandidateInput,
  actorInput: NewsroomActor,
  options: Readonly<{
    fenceToken?: number | null;
    recordAttempt?: boolean;
  }> = {},
): Promise<IngestProviderCandidateResult> {
  let normalized: NormalizedProviderIngest;
  try {
    normalized = normalizeProviderIngestCandidate(input);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new NewsroomError(
        'VALIDATION',
        400,
        error.issues[0]?.message ?? 'Invalid provider ingest candidate.',
      );
    }
    if (error instanceof TypeError) {
      throw new NewsroomError('VALIDATION', 400, error.message);
    }
    throw error;
  }

  const actor = parseActor(actorInput);
  const database = requireDatabase();
  await ensureBootstrapped();
  const startedAt = new Date();
  const recordAttempt = options.recordAttempt !== false;

  try {
    const result = await database.transaction(async (tx) => {
      const [provider] = await tx
        .select()
        .from(newsProviders)
        .where(eq(newsProviders.providerKey, normalized.providerKey))
        .limit(1);
      const [source] = await tx
        .select()
        .from(newsSources)
        .where(eq(newsSources.sourceKey, normalized.sourceKey))
        .limit(1);

      const gate = decideProviderIngestGate({
        provider: provider
          ? {
              providerKey: provider.providerKey,
              configEnabled: provider.configEnabled,
              commercialStatus: provider.commercialStatus,
            }
          : null,
        source: source
          ? {
              sourceKey: source.sourceKey,
              enabled: source.enabled,
              ownerKey: source.ownerKey,
              commercialStatus: source.commercialStatus,
            }
          : null,
        candidateOwnerKey: normalized.ownerKey,
      });
      if (!gate.allowed) {
        throw gateToError(gate.reason);
      }
      if (!source) {
        throw gateToError('source_missing');
      }

      const [insertedSignal] = await tx
        .insert(newsSignals)
        .values({
          sourceId: source.id,
          externalId: normalized.externalId,
          canonicalUrl: normalized.canonicalUrl,
          exactUrlHash: normalized.exactUrlHash,
          exactContentHash: normalized.exactContentHash,
          headline: normalized.headline,
          summary: normalized.summary,
          sport: normalized.sport,
          sourcePublishedAt: normalized.sourcePublishedAt,
          observedAt: normalized.observedAt,
          rawPayload: normalized.rawPayload,
        })
        .onConflictDoNothing()
        .returning();

      if (!insertedSignal) {
        const conditions = [
          and(
            eq(newsSignals.sourceId, source.id),
            eq(newsSignals.externalId, normalized.externalId),
          ),
          eq(newsSignals.exactContentHash, normalized.exactContentHash),
        ];
        if (normalized.exactUrlHash) {
          conditions.push(eq(newsSignals.exactUrlHash, normalized.exactUrlHash));
        }
        const [existingSignal] = await tx
          .select()
          .from(newsSignals)
          .where(or(...conditions))
          .limit(1);
        if (!existingSignal) {
          throw new NewsroomError('CONFLICT', 409, 'A concurrent provider signal could not be reconciled.');
        }

        const [linked] = await tx
          .select({ event: newsEvents })
          .from(newsEventSignals)
          .innerJoin(newsEvents, eq(newsEvents.id, newsEventSignals.eventId))
          .where(eq(newsEventSignals.signalId, existingSignal.id))
          .orderBy(desc(newsEvents.updatedAt))
          .limit(1);
        if (!linked) {
          throw new NewsroomError(
            'CONFLICT',
            409,
            'The duplicate provider signal is missing its event link.',
          );
        }

        const activity = await appendActivity(tx, {
          eventId: linked.event.id,
          signalId: existingSignal.id,
          actor,
          action: 'signal.provider_deduplicated',
          summary: `Provider duplicate matched: ${existingSignal.headline}`,
          metadata: {
            providerKey: normalized.providerKey,
            externalId: normalized.externalId,
            payloadHash: normalized.payloadHash,
            exactContentHash: normalized.exactContentHash,
            exactUrlHash: normalized.exactUrlHash,
            fenceToken: options.fenceToken ?? null,
          },
        });

        return {
          created: false,
          deduplicated: true,
          signal: existingSignal,
          event: linked.event,
          activity,
          normalized,
        };
      }

      const signalTime = normalized.sourcePublishedAt ?? insertedSignal.observedAt;
      const [event] = await tx
        .insert(newsEvents)
        .values({
          headline: normalized.headline,
          summary: normalized.summary,
          sport: normalized.sport,
          urgency: normalized.urgency,
          state: 'new',
          firstSignalAt: signalTime,
          lastSignalAt: signalTime,
        })
        .returning();
      if (!event) {
        throw new NewsroomError('CONFLICT', 409, 'The newsroom event could not be created.');
      }

      await tx.insert(newsEventSignals).values({
        eventId: event.id,
        signalId: insertedSignal.id,
        linkage: 'exact',
      });

      const activity = await appendActivity(tx, {
        eventId: event.id,
        signalId: insertedSignal.id,
        actor,
        action: 'signal.provider_created',
        toState: 'new',
        summary: `Provider signal created: ${event.headline}`,
        metadata: {
          providerKey: normalized.providerKey,
          externalId: normalized.externalId,
          payloadHash: normalized.payloadHash,
          exactContentHash: normalized.exactContentHash,
          exactUrlHash: normalized.exactUrlHash,
          ownerKey: normalized.ownerKey,
          ownerIdentity: normalized.ownerIdentity,
          fenceToken: options.fenceToken ?? null,
        },
      });

      return {
        created: true,
        deduplicated: false,
        signal: insertedSignal,
        event,
        activity,
        normalized,
      };
    });

    let ingestAttemptId: string | null = null;
    if (recordAttempt) {
      try {
        const attempt = await recordProviderIngestAttempt({
          providerKey: normalized.providerKey,
          attemptKind: 'persist',
          outcome: result.deduplicated ? 'duplicate' : 'success',
          startedAt,
          finishedAt: new Date(),
          fenceToken: options.fenceToken ?? null,
          externalId: normalized.externalId,
          payloadHash: normalized.payloadHash,
          metadata: {
            created: result.created,
            deduplicated: result.deduplicated,
            signalId: result.signal.id,
            eventId: result.event.id,
            // Explicitly assert no editorial mutation occurred.
            verified: false,
            published: false,
          },
        });
        ingestAttemptId = attempt.id;
      } catch {
        // The signal write is authoritative. Attempt ledger failure must not
        // roll back a successful editorial-safe ingest, but operators should
        // still see the signal/activity rows.
        ingestAttemptId = null;
      }
    }

    return { ...result, ingestAttemptId };
  } catch (error) {
    if (recordAttempt && error instanceof NewsroomError) {
      try {
        await recordProviderIngestAttempt({
          providerKey: normalized.providerKey,
          attemptKind: 'persist',
          outcome: 'failure',
          startedAt,
          finishedAt: new Date(),
          fenceToken: options.fenceToken ?? null,
          externalId: normalized.externalId,
          payloadHash: normalized.payloadHash,
          errorCode: error.code,
          errorSummary: error.message.slice(0, 500),
        });
      } catch {
        // Best-effort failure ledger only.
      }
    }
    throw error;
  }
}
