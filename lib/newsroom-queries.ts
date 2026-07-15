import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { z, ZodError } from 'zod';
import { db } from './db/client';
import { ensureBootstrapped } from './db/bootstrap';
import {
  newsEventSignals,
  newsEvents,
  newsEvidence,
  newsroomActivity,
  newsSignals,
  newsSources,
  newsVerificationReviews,
  type NewsEvent,
  type NewsEvidence,
  type NewsSignal,
  type NewsSource,
  type NewsVerificationReview,
} from './db/schema';
import {
  createExactContentHash,
  createExactUrlHash,
  normalizeExactNewsUrl,
} from './newsroom-clustering';
import {
  assertNewsEventTransition,
  isNewsEventState,
  newsEventStateAfterEvidenceAdded,
  type NewsEventState,
  type NewsUrgency,
} from './newsroom-state';
import {
  dismissNewsEventInputSchema,
  MANUAL_NEWSROOM_SOURCE_KEY,
  manualNewsSignalInputSchema,
  newsEvidenceInputSchema,
  updateNewsEventInputSchema,
  verifyNewsEventInputSchema,
  type DismissNewsEventInput,
  type ManualNewsSignalInput,
  type NewsEvidenceInput,
  type UpdateNewsEventInput,
  type VerifyNewsEventInput,
} from './newsroom-validation';
import {
  assessNewsVerification,
  type NewsVerificationAssessment,
} from './newsroom-verification';

export type NewsroomErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INVALID_STATE'
  | 'VERIFICATION_FAILED'
  | 'DB_UNAVAILABLE';

export class NewsroomError extends Error {
  constructor(
    public readonly code: NewsroomErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'NewsroomError';
  }
}

export type NewsroomActor = {
  userId?: string | null;
  label: string;
};

export type NewsroomActivityFeedItem = {
  sequence: number;
  eventId: string | null;
  signalId: string | null;
  action: string;
  actorLabel: string;
  fromState: string | null;
  toState: string | null;
  summary: string;
  createdAt: Date;
};

export type NewsroomSnapshotCounts = Record<NewsEventState, number> & {
  breaking: number;
};

export type NewsroomSnapshot = {
  generatedAt: Date;
  latestActivitySeq: number;
  counts: NewsroomSnapshotCounts;
  events: NewsEvent[];
  sources: NewsSource[];
  recentActivity: NewsroomActivityFeedItem[];
};

export type NewsEventSnapshot = {
  event: NewsEvent;
  signals: NewsSignal[];
  evidence: NewsEvidence[];
  reviews: NewsVerificationReview[];
  activity: NewsroomActivityFeedItem[];
};

export type CreateManualNewsSignalResult = {
  created: boolean;
  deduplicated: boolean;
  signal: NewsSignal;
  event: NewsEvent;
  activity: NewsroomActivityFeedItem;
};

export type AddNewsEvidenceResult = {
  evidence: NewsEvidence;
  event: NewsEvent;
  activity: NewsroomActivityFeedItem;
};

export type VerifyNewsEventResult = {
  event: NewsEvent;
  review: NewsVerificationReview;
  assessment: NewsVerificationAssessment;
  activity: NewsroomActivityFeedItem;
};

export type NewsEventMutationResult = {
  event: NewsEvent;
  activity: NewsroomActivityFeedItem;
};

export type ListNewsEventsOptions = {
  states?: NewsEventState[];
  urgencies?: NewsUrgency[];
  limit?: number;
};

export type NewsroomSnapshotOptions = {
  eventLimit?: number;
  activityLimit?: number;
};

const activityFeedSelection = {
  sequence: newsroomActivity.sequence,
  eventId: newsroomActivity.eventId,
  signalId: newsroomActivity.signalId,
  action: newsroomActivity.action,
  actorLabel: newsroomActivity.actorLabel,
  fromState: newsroomActivity.fromState,
  toState: newsroomActivity.toState,
  summary: newsroomActivity.summary,
  createdAt: newsroomActivity.createdAt,
};

type Database = NonNullable<typeof db>;
type NewsroomTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];

const actorSchema = z.object({
  userId: z.string().uuid().nullish(),
  label: z.string().trim().min(2).max(160),
});

function parseInput<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new NewsroomError('VALIDATION', 400, error.issues[0]?.message ?? 'Invalid newsroom input.');
    }
    throw error;
  }
}

function parseActor(actor: NewsroomActor): Required<NewsroomActor> {
  const parsed = parseInput(actorSchema, actor);
  return { userId: parsed.userId ?? null, label: parsed.label };
}

function requireDatabase(): Database {
  if (!db) {
    throw new NewsroomError('DB_UNAVAILABLE', 503, 'The newsroom database is unavailable.');
  }
  return db;
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new NewsroomError('VALIDATION', 400, 'Limit must be a positive integer.');
  }
  return Math.min(value, maximum);
}

function auditSummary(value: string): string {
  return value.replace(/[\p{Cc}\p{Cf}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function asEventState(value: string): NewsEventState {
  if (!isNewsEventState(value)) {
    throw new NewsroomError('INVALID_STATE', 409, 'The event contains an unknown workflow state.');
  }
  return value;
}

async function appendActivity(
  tx: NewsroomTransaction,
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
    .returning(activityFeedSelection);
  if (!activity) {
    throw new NewsroomError('CONFLICT', 409, 'The newsroom activity record could not be created.');
  }
  return activity;
}

export async function listNewsEvents(options: ListNewsEventsOptions = {}): Promise<NewsEvent[]> {
  const database = requireDatabase();
  await ensureBootstrapped();
  const limit = boundedLimit(options.limit, 50, 100);
  const filters = [];
  if (options.states?.length) filters.push(inArray(newsEvents.state, options.states));
  if (options.urgencies?.length) filters.push(inArray(newsEvents.urgency, options.urgencies));

  return database
    .select()
    .from(newsEvents)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(newsEvents.updatedAt), desc(newsEvents.createdAt))
    .limit(limit);
}

export async function listNewsroomActivity(
  afterSeq = 0,
  limit?: number,
): Promise<NewsroomActivityFeedItem[]> {
  if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) {
    throw new NewsroomError('VALIDATION', 400, 'Activity cursor must be a non-negative integer.');
  }
  const database = requireDatabase();
  await ensureBootstrapped();
  return database
    .select(activityFeedSelection)
    .from(newsroomActivity)
    .where(gt(newsroomActivity.sequence, afterSeq))
    .orderBy(asc(newsroomActivity.sequence))
    .limit(boundedLimit(limit, 100, 250));
}

export async function getNewsroomSnapshot(
  options: NewsroomSnapshotOptions = {},
): Promise<NewsroomSnapshot> {
  const database = requireDatabase();
  await ensureBootstrapped();
  const eventLimit = boundedLimit(options.eventLimit, 50, 100);
  const activityLimit = boundedLimit(options.activityLimit, 30, 100);

  const [events, sources, recentActivity, stateCounts, breakingRows] = await Promise.all([
    database.select().from(newsEvents).orderBy(desc(newsEvents.updatedAt)).limit(eventLimit),
    database
      .select()
      .from(newsSources)
      .where(
        and(
          eq(newsSources.enabled, true),
          eq(newsSources.commercialStatus, 'approved'),
        ),
      )
      .orderBy(asc(newsSources.displayName))
      .limit(100),
    database
      .select(activityFeedSelection)
      .from(newsroomActivity)
      .orderBy(desc(newsroomActivity.sequence))
      .limit(activityLimit),
    database
      .select({ state: newsEvents.state, count: sql<number>`count(*)::int` })
      .from(newsEvents)
      .groupBy(newsEvents.state)
      .limit(10),
    database
      .select({ count: sql<number>`count(*)::int` })
      .from(newsEvents)
      .where(and(eq(newsEvents.urgency, 'breaking'), ne(newsEvents.state, 'dismissed')))
      .limit(1),
  ]);

  const counts: NewsroomSnapshotCounts = {
    new: 0,
    investigating: 0,
    verification_ready: 0,
    verified: 0,
    dismissed: 0,
    breaking: breakingRows[0]?.count ?? 0,
  };
  for (const row of stateCounts) {
    if (isNewsEventState(row.state)) counts[row.state] = row.count;
  }

  return {
    generatedAt: new Date(),
    latestActivitySeq: recentActivity[0]?.sequence ?? 0,
    counts,
    events,
    sources,
    recentActivity,
  };
}

export async function getNewsEventSnapshot(eventId: string): Promise<NewsEventSnapshot> {
  const parsedEventId = parseInput(z.string().uuid(), eventId);
  const database = requireDatabase();
  await ensureBootstrapped();
  const [event] = await database.select().from(newsEvents).where(eq(newsEvents.id, parsedEventId)).limit(1);
  if (!event) throw new NewsroomError('NOT_FOUND', 404, 'Newsroom event not found.');

  const [signalRows, evidence, reviews, activity] = await Promise.all([
    database
      .select({ signal: newsSignals })
      .from(newsEventSignals)
      .innerJoin(newsSignals, eq(newsSignals.id, newsEventSignals.signalId))
      .where(eq(newsEventSignals.eventId, parsedEventId))
      .orderBy(desc(newsSignals.observedAt))
      .limit(100),
    database
      .select()
      .from(newsEvidence)
      .where(eq(newsEvidence.eventId, parsedEventId))
      .orderBy(asc(newsEvidence.createdAt))
      .limit(500),
    database
      .select()
      .from(newsVerificationReviews)
      .where(eq(newsVerificationReviews.eventId, parsedEventId))
      .orderBy(desc(newsVerificationReviews.createdAt))
      .limit(100),
    database
      .select(activityFeedSelection)
      .from(newsroomActivity)
      .where(eq(newsroomActivity.eventId, parsedEventId))
      .orderBy(asc(newsroomActivity.sequence))
      .limit(250),
  ]);

  return { event, signals: signalRows.map((row) => row.signal), evidence, reviews, activity };
}

export async function createManualNewsSignal(
  input: ManualNewsSignalInput,
  actorInput: NewsroomActor,
): Promise<CreateManualNewsSignalResult> {
  const parsed = parseInput(manualNewsSignalInputSchema, input);
  const actor = parseActor(actorInput);
  const database = requireDatabase();
  await ensureBootstrapped();
  const canonicalUrl = parsed.canonicalUrl ? normalizeExactNewsUrl(parsed.canonicalUrl) : null;
  const exactUrlHash = createExactUrlHash(canonicalUrl);
  const exactContentHash = createExactContentHash(parsed.headline, parsed.summary);

  return database.transaction(async (tx) => {
    const [source] = await tx
      .select()
      .from(newsSources)
      .where(and(eq(newsSources.sourceKey, MANUAL_NEWSROOM_SOURCE_KEY), eq(newsSources.enabled, true)))
      .limit(1);
    if (!source) {
      throw new NewsroomError('DB_UNAVAILABLE', 503, 'The manual newsroom source is not configured.');
    }

    const [insertedSignal] = await tx
      .insert(newsSignals)
      .values({
        sourceId: source.id,
        canonicalUrl,
        exactUrlHash,
        exactContentHash,
        headline: parsed.headline,
        summary: parsed.summary,
        sport: parsed.sport,
        sourcePublishedAt: parsed.sourcePublishedAt,
        rawPayload: { intake: MANUAL_NEWSROOM_SOURCE_KEY },
      })
      .onConflictDoNothing()
      .returning();

    if (!insertedSignal) {
      const conditions = [eq(newsSignals.exactContentHash, exactContentHash)];
      if (exactUrlHash) conditions.push(eq(newsSignals.exactUrlHash, exactUrlHash));
      const [existingSignal] = await tx
        .select()
        .from(newsSignals)
        .where(or(...conditions))
        .limit(1);
      if (!existingSignal) {
        throw new NewsroomError('CONFLICT', 409, 'A concurrent signal could not be reconciled.');
      }
      const [linked] = await tx
        .select({ event: newsEvents })
        .from(newsEventSignals)
        .innerJoin(newsEvents, eq(newsEvents.id, newsEventSignals.eventId))
        .where(eq(newsEventSignals.signalId, existingSignal.id))
        .orderBy(desc(newsEvents.updatedAt))
        .limit(1);
      if (!linked) {
        throw new NewsroomError('CONFLICT', 409, 'The duplicate signal is missing its event link.');
      }
      const activity = await appendActivity(tx, {
        eventId: linked.event.id,
        signalId: existingSignal.id,
        actor,
        action: 'signal.deduplicated',
        summary: `Duplicate signal matched: ${existingSignal.headline}`,
        metadata: { exactUrlHash, exactContentHash },
      });
      return {
        created: false,
        deduplicated: true,
        signal: existingSignal,
        event: linked.event,
        activity,
      };
    }

    const signalTime = parsed.sourcePublishedAt ?? insertedSignal.observedAt;
    const [event] = await tx
      .insert(newsEvents)
      .values({
        headline: parsed.headline,
        summary: parsed.summary,
        sport: parsed.sport,
        urgency: parsed.urgency,
        state: 'new',
        firstSignalAt: signalTime,
        lastSignalAt: signalTime,
      })
      .returning();
    if (!event) throw new NewsroomError('CONFLICT', 409, 'The newsroom event could not be created.');

    await tx.insert(newsEventSignals).values({
      eventId: event.id,
      signalId: insertedSignal.id,
      linkage: 'manual',
    });
    const activity = await appendActivity(tx, {
      eventId: event.id,
      signalId: insertedSignal.id,
      actor,
      action: 'signal.created',
      toState: 'new',
      summary: `Manual signal created: ${event.headline}`,
      metadata: { urgency: event.urgency, exactUrlHash, exactContentHash },
    });
    return { created: true, deduplicated: false, signal: insertedSignal, event, activity };
  });
}

export async function addNewsEvidence(
  input: NewsEvidenceInput,
  actorInput: NewsroomActor,
): Promise<AddNewsEvidenceResult> {
  const parsed = parseInput(newsEvidenceInputSchema, input);
  const actor = parseActor(actorInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  return database.transaction(async (tx) => {
    const [existingEvent] = await tx
      .select()
      .from(newsEvents)
      .where(eq(newsEvents.id, parsed.eventId))
      .limit(1);
    if (!existingEvent) throw new NewsroomError('NOT_FOUND', 404, 'Newsroom event not found.');

    if (parsed.sourceId) {
      const [source] = await tx.select().from(newsSources).where(eq(newsSources.id, parsed.sourceId)).limit(1);
      if (!source) throw new NewsroomError('NOT_FOUND', 404, 'Evidence source not found.');
      if (!source.enabled || source.commercialStatus !== 'approved') {
        throw new NewsroomError(
          'VALIDATION',
          400,
          'Evidence source is not enabled and commercially approved.',
        );
      }
      const sourceIsCredible = source.tier !== 'unverified';
      if (
        source.ownerKey !== parsed.ownerKey ||
        source.tier !== parsed.sourceTier ||
        sourceIsCredible !== parsed.credible
      ) {
        throw new NewsroomError('VALIDATION', 400, 'Evidence attribution does not match the source registry.');
      }
    }

    if (parsed.signalId) {
      const [link] = await tx
        .select({ signalId: newsEventSignals.signalId })
        .from(newsEventSignals)
        .where(
          and(
            eq(newsEventSignals.eventId, parsed.eventId),
            eq(newsEventSignals.signalId, parsed.signalId),
          ),
        )
        .limit(1);
      if (!link) throw new NewsroomError('VALIDATION', 400, 'Evidence signal is not linked to this event.');
    }

    if (parsed.supersedesEvidenceId) {
      const [superseded] = await tx
        .select({ id: newsEvidence.id })
        .from(newsEvidence)
        .where(
          and(
            eq(newsEvidence.id, parsed.supersedesEvidenceId),
            eq(newsEvidence.eventId, parsed.eventId),
          ),
        )
        .limit(1);
      if (!superseded) {
        throw new NewsroomError('VALIDATION', 400, 'Superseded evidence must belong to this event.');
      }
    }

    const [evidence] = await tx
      .insert(newsEvidence)
      .values({
        eventId: parsed.eventId,
        sourceId: parsed.sourceId,
        signalId: parsed.signalId,
        supersedesEvidenceId: parsed.supersedesEvidenceId,
        stance: parsed.stance,
        evidenceClass: parsed.evidenceClass,
        ownerKey: parsed.ownerKey,
        sourceTier: parsed.sourceTier,
        credible: parsed.credible,
        label: parsed.label,
        url: parsed.url,
        excerpt: parsed.excerpt,
        notes: parsed.notes,
        capturedAt: parsed.capturedAt,
        addedBy: actor.userId,
      })
      .returning();
    if (!evidence) throw new NewsroomError('CONFLICT', 409, 'Evidence could not be recorded.');

    const previousState = asEventState(existingEvent.state);
    const nextState = newsEventStateAfterEvidenceAdded(previousState);
    const [event] = await tx
      .update(newsEvents)
      .set({
        state: nextState,
        version: existingEvent.version + 1,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(newsEvents.id, parsed.eventId),
          eq(newsEvents.version, existingEvent.version),
        ),
      )
      .returning();
    if (!event) throw new NewsroomError('CONFLICT', 409, 'The event changed while adding evidence.');

    const activity = await appendActivity(tx, {
      eventId: event.id,
      signalId: parsed.signalId,
      actor,
      action: 'evidence.added',
      fromState: previousState,
      toState: nextState,
      summary:
        previousState === 'verified'
          ? `${parsed.stance} evidence added; prior verification reopened: ${parsed.label}`
          : `${parsed.stance} evidence added: ${parsed.label}`,
      metadata: {
        evidenceId: evidence.id,
        evidenceClass: evidence.evidenceClass,
        supersedesEvidenceId: evidence.supersedesEvidenceId,
        verificationReopened: previousState === 'verified',
      },
    });
    return { evidence, event, activity };
  });
}

export async function updateNewsEvent(
  input: UpdateNewsEventInput,
  actorInput: NewsroomActor,
): Promise<NewsEventMutationResult> {
  const parsed = parseInput(updateNewsEventInputSchema, input);
  const actor = parseActor(actorInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  return database.transaction(async (tx) => {
    const [existing] = await tx.select().from(newsEvents).where(eq(newsEvents.id, parsed.eventId)).limit(1);
    if (!existing) throw new NewsroomError('NOT_FOUND', 404, 'Newsroom event not found.');
    if (existing.version !== parsed.expectedVersion) {
      throw new NewsroomError('CONFLICT', 409, 'The event changed; refresh before saving.');
    }
    const fromState = asEventState(existing.state);
    const toState = parsed.targetState ?? fromState;
    try {
      assertNewsEventTransition(fromState, toState);
    } catch {
      throw new NewsroomError('INVALID_STATE', 409, `Event cannot move from ${fromState} to ${toState}.`);
    }

    const [event] = await tx
      .update(newsEvents)
      .set({
        headline: parsed.headline ?? existing.headline,
        summary: parsed.summary ?? existing.summary,
        sport: parsed.sport ?? existing.sport,
        urgency: parsed.urgency ?? existing.urgency,
        state: toState,
        version: existing.version + 1,
        updatedAt: new Date(),
      })
      .where(and(eq(newsEvents.id, parsed.eventId), eq(newsEvents.version, parsed.expectedVersion)))
      .returning();
    if (!event) throw new NewsroomError('CONFLICT', 409, 'The event changed; refresh before saving.');
    const stateChanged = fromState !== toState;
    const activity = await appendActivity(tx, {
      eventId: event.id,
      actor,
      action: stateChanged ? 'event.state_changed' : 'event.updated',
      fromState,
      toState,
      summary: stateChanged
        ? `Event moved from ${fromState} to ${toState}: ${event.headline}`
        : `Event details updated: ${event.headline}`,
      metadata: { version: event.version },
    });
    return { event, activity };
  });
}

export async function verifyNewsEvent(
  input: VerifyNewsEventInput,
  actorInput: NewsroomActor,
): Promise<VerifyNewsEventResult> {
  const parsed = parseInput(verifyNewsEventInputSchema, input);
  const actor = parseActor(actorInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  const outcome = await database.transaction(async (tx) => {
    const [existing] = await tx.select().from(newsEvents).where(eq(newsEvents.id, parsed.eventId)).limit(1);
    if (!existing) throw new NewsroomError('NOT_FOUND', 404, 'Newsroom event not found.');
    if (existing.version !== parsed.expectedVersion) {
      throw new NewsroomError('CONFLICT', 409, 'The event changed; refresh before verification.');
    }
    const fromState = asEventState(existing.state);
    if (fromState !== 'verification_ready') {
      throw new NewsroomError('INVALID_STATE', 409, 'Only a verification-ready event can be verified.');
    }

    const evidence = await tx
      .select()
      .from(newsEvidence)
      .where(eq(newsEvidence.eventId, parsed.eventId))
      .orderBy(asc(newsEvidence.createdAt))
      .limit(501);
    if (evidence.length > 500) {
      throw new NewsroomError('CONFLICT', 409, 'Evidence exceeds the safe review bound; consolidate manually.');
    }
    const assessment = assessNewsVerification(evidence);
    const nextVersion = existing.version + 1;
    const decision = assessment.passes ? 'verified' : 'rejected';
    const [review] = await tx
      .insert(newsVerificationReviews)
      .values({
        eventId: existing.id,
        reviewerId: actor.userId,
        reviewerLabel: actor.label,
        decision,
        rationale: parsed.rationale,
        eventVersion: existing.version,
        criteriaSnapshot: assessment,
      })
      .returning();
    if (!review) throw new NewsroomError('CONFLICT', 409, 'The verification review could not be recorded.');

    const [event] = await tx
      .update(newsEvents)
      .set({
        state: assessment.passes ? 'verified' : existing.state,
        version: nextVersion,
        updatedAt: new Date(),
      })
      .where(and(eq(newsEvents.id, existing.id), eq(newsEvents.version, existing.version)))
      .returning();
    if (!event) throw new NewsroomError('CONFLICT', 409, 'The event changed during verification.');

    const activity = await appendActivity(tx, {
      eventId: event.id,
      actor,
      action: assessment.passes ? 'event.verified' : 'event.verification_failed',
      fromState,
      toState: event.state,
      summary: assessment.passes
        ? `Event verified: ${event.headline}`
        : `Verification blocked (${assessment.reason}): ${event.headline}`,
      metadata: { reviewId: review.id, assessment },
    });
    return { event, review, assessment, activity };
  });

  if (!outcome.assessment.passes) {
    throw new NewsroomError(
      'VERIFICATION_FAILED',
      422,
      outcome.assessment.reason === 'contradiction_present'
        ? 'Verification is blocked by contradictory evidence.'
        : 'Verification requires primary/official support or two independent credible sources.',
    );
  }
  return outcome;
}

export async function dismissNewsEvent(
  input: DismissNewsEventInput,
  actorInput: NewsroomActor,
): Promise<NewsEventMutationResult> {
  const parsed = parseInput(dismissNewsEventInputSchema, input);
  const actor = parseActor(actorInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  return database.transaction(async (tx) => {
    const [existing] = await tx.select().from(newsEvents).where(eq(newsEvents.id, parsed.eventId)).limit(1);
    if (!existing) throw new NewsroomError('NOT_FOUND', 404, 'Newsroom event not found.');
    if (existing.version !== parsed.expectedVersion) {
      throw new NewsroomError('CONFLICT', 409, 'The event changed; refresh before dismissing.');
    }
    const fromState = asEventState(existing.state);
    try {
      assertNewsEventTransition(fromState, 'dismissed');
    } catch {
      throw new NewsroomError('INVALID_STATE', 409, `Event cannot be dismissed from ${fromState}.`);
    }

    const [review] = await tx
      .insert(newsVerificationReviews)
      .values({
        eventId: existing.id,
        reviewerId: actor.userId,
        reviewerLabel: actor.label,
        decision: 'rejected',
        rationale: parsed.rationale,
        eventVersion: existing.version,
        criteriaSnapshot: { reason: 'manually_dismissed' },
      })
      .returning({ id: newsVerificationReviews.id });
    if (!review) throw new NewsroomError('CONFLICT', 409, 'The dismissal review could not be recorded.');

    const [event] = await tx
      .update(newsEvents)
      .set({ state: 'dismissed', version: existing.version + 1, updatedAt: new Date() })
      .where(and(eq(newsEvents.id, existing.id), eq(newsEvents.version, existing.version)))
      .returning();
    if (!event) throw new NewsroomError('CONFLICT', 409, 'The event changed while dismissing.');
    const activity = await appendActivity(tx, {
      eventId: event.id,
      actor,
      action: 'event.dismissed',
      fromState,
      toState: 'dismissed',
      summary: `Event dismissed: ${event.headline}`,
      metadata: { reviewId: review.id, rationale: parsed.rationale },
    });
    return { event, activity };
  });
}
