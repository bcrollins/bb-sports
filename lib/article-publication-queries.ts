import { evaluatePublishSourceGate } from './article-source-gate';
import {
  and,
  eq,
  inArray,
  isNull,
  ne,
  sql,
} from 'drizzle-orm';
import { z, ZodError } from 'zod';
import {
  ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
  ArticlePublicationInvariantError,
  articleHeroMediaAssetId,
  articlePublicationSnapshotSchema,
  articlePublishRequestSchema,
  articleRevisionPrepareRequestSchema,
  canPublishArticle,
  createVerifiedNewsroomArticleDraft,
  hashArticlePublicationSnapshot,
  normalizeArticlePublicationSnapshot,
  type ArticlePublicationSnapshot,
  type ArticlePublishRequest,
} from './article-publication';
import { assessNewsVerification } from './newsroom-verification';
import { db } from './db/client';
import { ensureBootstrapped } from './db/bootstrap';
import {
  articlePublicationEvents,
  articleRevisions,
  articles,
  comments,
  mediaAssets,
  newsEventArticles,
  newsEvents,
  newsEvidence,
  newsSources,
  newsroomActivity,
  users,
  type Article,
  type ArticlePublicationEvent,
  type ArticleRevision,
  type NewsEventArticle,
  type NewsEvidence,
} from './db/schema';

export type PublicationErrorCode =
  | 'VALIDATION'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'FORBIDDEN'
  | 'INVALID_STATE'
  | 'VERIFICATION_FAILED'
  | 'RELEASE_CONVERGENCE'
  | 'DB_UNAVAILABLE';

export class PublicationError extends Error {
  constructor(
    public readonly code: PublicationErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'PublicationError';
  }
}

// Descriptive alias retained for callers that prefer the longer domain name.
export { PublicationError as ArticlePublicationError };

export type ArticlePublicationActor = {
  userId: string;
  label: string;
};

export function publicationActor(user: { id: string; name: string }): ArticlePublicationActor {
  return { userId: user.id, label: user.name };
}

export type ArticleRevisionResult = {
  article: Article;
  revision: ArticleRevision;
};

export type ArticlePublishResult = ArticleRevisionResult & {
  publicationEvent: ArticlePublicationEvent;
};

export type VerifiedEventArticleDraftResult = ArticleRevisionResult & {
  link: NewsEventArticle;
  created: boolean;
};

export type ArticlePublicationStatus = {
  published: boolean;
  draftHash: string | null;
  draftValidationError: string | null;
  currentPublishedHash: string | null;
  currentPublishedRevisionId: string | null;
  hasUnpublishedChanges: boolean;
  publishedSlug: string | null;
  publishedRevisionNumber: number | null;
};

type Database = NonNullable<typeof db>;
type PublicationTransaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type CanonicalActor = Readonly<{ userId: string; label: string; role: string }>;

const actorSchema = z
  .object({
    userId: z.string().uuid(),
    label: z.string().trim().min(2).max(160),
  })
  .strict();

const articleIdSchema = z.string().uuid();
const unpublishRationaleSchema = z
  .string()
  .transform((value) => value.normalize('NFC').replace(/\r\n?/g, '\n').trim())
  .pipe(z.string().min(20).max(4_000));

function parseInput<T>(schema: { parse: (value: unknown) => T }, value: unknown): T {
  try {
    return schema.parse(value);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new PublicationError(
        'VALIDATION',
        400,
        error.issues[0]?.message ?? 'Invalid article publication input.',
      );
    }
    throw error;
  }
}

export function isPostgresConstraintViolation(
  error: unknown,
  code: string,
  constraintName: string,
): boolean {
  const visited = new Set<unknown>();
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== 'object' || current === null || visited.has(current)) return false;
    visited.add(current);
    const record = current as Record<string, unknown>;
    if (
      record.code === code &&
      (record.constraint_name === constraintName || record.constraint === constraintName)
    ) {
      return true;
    }
    current = record.cause;
  }
  return false;
}

export function isArticleSlugUniqueViolation(error: unknown): boolean {
  return (
    isPostgresConstraintViolation(error, '23505', 'articles_slug_key') ||
    isPostgresConstraintViolation(error, '23505', 'articles_slug_unique')
  );
}

function requireDatabase(): Database {
  if (!db) {
    throw new PublicationError(
      'DB_UNAVAILABLE',
      503,
      'The article publication database is unavailable.',
    );
  }
  return db;
}

/** Build the one canonical reader-visible snapshot from editable columns. */
export function articlePublicationSnapshotFromArticle(
  article: Pick<
    Article,
    | 'slug'
    | 'title'
    | 'dek'
    | 'body'
    | 'sport'
    | 'hero'
    | 'heroAlt'
    | 'heroCredit'
    | 'authorName'
    | 'aiAssisted'
    | 'bradsTake'
  >,
): ArticlePublicationSnapshot {
  return normalizeArticlePublicationSnapshot({
    slug: article.slug,
    title: article.title,
    dek: article.dek,
    body: article.body,
    sport: article.sport,
    hero: article.hero,
    heroAlt: article.heroAlt,
    heroCredit: article.heroCredit,
    authorName: article.authorName,
    aiAssisted: article.aiAssisted,
    bradsTake: article.bradsTake,
  });
}

/**
 * Overlay a verified immutable snapshot onto a database row. Any malformed,
 * incomplete, or hash-mismatched live pointer fails closed and returns null;
 * mutable working columns are never substituted for corrupted public data.
 */
export function materializePublishedArticle(
  article: Article,
  revision?: ArticleRevision | null,
): Article | null {
  if (
    !article.published ||
    !article.publishedAt ||
    !article.publishedSnapshot ||
    !article.publishedContentHash ||
    !article.publishedRevisionId ||
    !revision ||
    revision.id !== article.publishedRevisionId ||
    revision.articleId !== article.id ||
    revision.contentHash !== article.publishedContentHash
  ) {
    return null;
  }
  const parsed = articlePublicationSnapshotSchema.safeParse(article.publishedSnapshot);
  const revisionParsed = articlePublicationSnapshotSchema.safeParse(revision.snapshot);
  if (!parsed.success || !revisionParsed.success) return null;
  if (hashArticlePublicationSnapshot(parsed.data) !== article.publishedContentHash) return null;
  if (hashArticlePublicationSnapshot(revisionParsed.data) !== revision.contentHash) return null;
  if (JSON.stringify(parsed.data) !== JSON.stringify(revisionParsed.data)) return null;

  return {
    ...article,
    ...parsed.data,
    publishedSnapshot: parsed.data,
  };
}

function parseActor(actor: ArticlePublicationActor): ArticlePublicationActor {
  return parseInput(actorSchema, actor);
}

async function requireCurrentActor(
  tx: PublicationTransaction,
  actorInput: ArticlePublicationActor,
  options: { superAdmin: boolean },
): Promise<CanonicalActor> {
  const actor = parseActor(actorInput);
  // A share lock prevents a role change from racing the privileged action.
  await tx.execute(sql`SELECT id FROM users WHERE id = ${actor.userId} FOR SHARE`);
  const [current] = await tx
    .select({ id: users.id, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, actor.userId))
    .limit(1);
  if (!current) {
    throw new PublicationError('FORBIDDEN', 403, 'The current publication user no longer exists.');
  }
  if (options.superAdmin && !canPublishArticle(current.role)) {
    throw new PublicationError(
      'FORBIDDEN',
      403,
      'Only the current BB Sports super administrator can perform this privileged editorial action.',
    );
  }
  return { userId: current.id, label: current.name, role: current.role };
}

async function lockArticle(
  tx: PublicationTransaction,
  articleId: string,
): Promise<Article> {
  await tx.execute(sql`SELECT id FROM articles WHERE id = ${articleId} FOR UPDATE`);
  const [article] = await tx
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new PublicationError('NOT_FOUND', 404, 'Article not found.');
  return article;
}

function validatedRevisionSnapshot(revision: ArticleRevision): ArticlePublicationSnapshot {
  const parsed = articlePublicationSnapshotSchema.safeParse(revision.snapshot);
  if (!parsed.success || hashArticlePublicationSnapshot(parsed.data) !== revision.contentHash) {
    throw new PublicationError(
      'CONFLICT',
      409,
      'The immutable article revision failed its content-integrity check.',
    );
  }
  return parsed.data;
}

type HeroMediaReadiness = Readonly<{
  kind: string;
  status: string;
  contentType: string;
  approved: boolean;
  hasBytes: boolean;
}>;

function heroMediaReadinessError(asset: HeroMediaReadiness | undefined): string | null {
  if (!asset) return 'The selected BB Sports media asset no longer exists.';
  if (asset.kind !== 'image') return 'An article hero must reference an image media asset.';
  if (asset.status !== 'ready') return 'The selected hero media asset is not ready.';
  if (!asset.approved) return 'The selected hero media asset still needs editorial approval.';
  if (!/^image\/(?:jpeg|png|webp)$/i.test(asset.contentType) || !asset.hasBytes) {
    return 'The selected hero media asset does not contain durable supported image bytes.';
  }
  return null;
}

async function assertHeroMediaPublicationReady(
  tx: PublicationTransaction,
  hero: string,
): Promise<void> {
  if (!hero) return;
  const mediaId = articleHeroMediaAssetId(hero);
  if (!mediaId) {
    throw new PublicationError(
      'INVALID_STATE',
      409,
      'Publication heroes must use an approved BB Sports media-library asset with durable immutable bytes.',
    );
  }
  const [asset] = await tx
    .select({
      kind: mediaAssets.kind,
      status: mediaAssets.status,
      contentType: mediaAssets.contentType,
      approved: mediaAssets.approved,
      hasBytes: sql<boolean>`length(${mediaAssets.dataBase64}) > 0`,
    })
    .from(mediaAssets)
    .where(eq(mediaAssets.id, mediaId))
    .limit(1)
    .for('share');
  const issue = heroMediaReadinessError(asset);
  if (issue) throw new PublicationError('INVALID_STATE', 409, issue);
}

function activeEvidence(evidence: readonly NewsEvidence[]): NewsEvidence[] {
  const superseded = new Set(
    evidence
      .map((item) => item.supersedesEvidenceId)
      .filter((id): id is string => Boolean(id)),
  );
  return evidence.filter((item) => !superseded.has(item.id));
}

async function assertActiveEvidenceSourcesApproved(
  tx: PublicationTransaction,
  evidence: readonly NewsEvidence[],
): Promise<void> {
  if (
    evidence.some(
      (item) =>
        item.sourceId === null &&
        item.stance === 'supporting' &&
        item.credible,
    )
  ) {
    throw new PublicationError(
      'VERIFICATION_FAILED',
      422,
      'Credible supporting evidence must be linked to an approved source registry entry.',
    );
  }
  const sourceIds = [
    ...new Set(
      evidence
        .map((item) => item.sourceId)
        .filter((sourceId): sourceId is string => Boolean(sourceId)),
    ),
  ];
  if (sourceIds.length === 0) return;
  const currentSources = await tx
    .select({
      id: newsSources.id,
      enabled: newsSources.enabled,
      commercialStatus: newsSources.commercialStatus,
    })
    .from(newsSources)
    .where(inArray(newsSources.id, sourceIds))
    .limit(sourceIds.length)
    .for('share');
  const approvedSourceIds = new Set(
    currentSources
      .filter((source) => source.enabled && source.commercialStatus === 'approved')
      .map((source) => source.id),
  );
  if (sourceIds.some((sourceId) => !approvedSourceIds.has(sourceId))) {
    throw new PublicationError(
      'VERIFICATION_FAILED',
      422,
      'An active evidence provider is missing, disabled, or no longer commercially approved.',
    );
  }
}

async function loadBoundedEventEvidence(
  tx: PublicationTransaction,
  eventIds: readonly string[],
): Promise<Map<string, NewsEvidence[]>> {
  const byEvent = new Map<string, NewsEvidence[]>();
  if (eventIds.length === 0) return byEvent;
  const rows = await tx
    .select()
    .from(newsEvidence)
    .where(inArray(newsEvidence.eventId, [...eventIds]))
    .orderBy(newsEvidence.createdAt)
    .limit(eventIds.length * 501);
  for (const row of rows) {
    const items = byEvent.get(row.eventId) ?? [];
    items.push(row);
    byEvent.set(row.eventId, items);
  }
  for (const eventId of eventIds) {
    if ((byEvent.get(eventId)?.length ?? 0) > 500) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'Newsroom evidence exceeds the safe publication-review bound.',
      );
    }
  }
  return byEvent;
}

async function assertLinkedEventsRemainVerified(
  tx: PublicationTransaction,
  articleId: string,
): Promise<void> {
  const links = await tx
    .select()
    .from(newsEventArticles)
    .where(and(eq(newsEventArticles.articleId, articleId), eq(newsEventArticles.relation, 'source')))
    .orderBy(newsEventArticles.createdAt)
    .limit(11);
  if (links.length > 10) {
    throw new PublicationError('CONFLICT', 409, 'Article has too many newsroom source events.');
  }
  if (links.length === 0) return;

  const eventIds = [...new Set(links.map((link) => link.eventId))];
  for (const eventId of eventIds) {
    await tx.execute(sql`SELECT id FROM news_events WHERE id = ${eventId} FOR UPDATE`);
  }
  const events = await tx
    .select()
    .from(newsEvents)
    .where(inArray(newsEvents.id, eventIds))
    .limit(eventIds.length);
  if (events.length !== eventIds.length || events.some((event) => event.state !== 'verified')) {
    throw new PublicationError(
      'VERIFICATION_FAILED',
      422,
      'A newsroom source event is no longer verified; publication is blocked.',
    );
  }

  const evidenceByEvent = await loadBoundedEventEvidence(tx, eventIds);
  await assertActiveEvidenceSourcesApproved(
    tx,
    [...evidenceByEvent.values()].flatMap((items) => activeEvidence(items)),
  );
  for (const event of events) {
    const assessment = assessNewsVerification(evidenceByEvent.get(event.id) ?? []);
    if (!assessment.passes) {
      throw new PublicationError(
        'VERIFICATION_FAILED',
        422,
        assessment.reason === 'contradiction_present'
          ? 'Fresh contradictory evidence blocks publication.'
          : 'Fresh evidence no longer satisfies the newsroom verification threshold.',
      );
    }
  }
}

export async function createArticleRevision(
  articleIdInput: string,
  actorInput: ArticlePublicationActor,
  expectedDraftHashInput: string,
): Promise<ArticleRevisionResult> {
  const articleId = parseInput(articleIdSchema, articleIdInput);
  const { expectedDraftHash } = parseInput(articleRevisionPrepareRequestSchema, {
    expectedDraftHash: expectedDraftHashInput,
  });
  const database = requireDatabase();
  await ensureBootstrapped();

  return database.transaction(async (tx) => {
    const actor = await requireCurrentActor(tx, actorInput, { superAdmin: false });
    const article = await lockArticle(tx, articleId);
    let snapshot: ArticlePublicationSnapshot;
    try {
      snapshot = articlePublicationSnapshotFromArticle(article);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new PublicationError(
          'VALIDATION',
          400,
          error.issues[0]?.message ?? 'The editable article is not publication-ready.',
        );
      }
      throw error;
    }
    const contentHash = hashArticlePublicationSnapshot(snapshot);
    if (contentHash !== expectedDraftHash) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'The draft changed on the server; reload it before preparing an approval revision.',
      );
    }
    await assertHeroMediaPublicationReady(tx, snapshot.hero);

    const [existing] = await tx
      .select()
      .from(articleRevisions)
      .where(
        and(
          eq(articleRevisions.articleId, article.id),
          eq(articleRevisions.contentHash, contentHash),
        ),
      )
      .limit(1);
    if (existing) {
      validatedRevisionSnapshot(existing);
      return { article, revision: existing };
    }

    const [counter, sourceLink] = await Promise.all([
      tx
        .select({ maximum: sql<number>`coalesce(max(${articleRevisions.revisionNumber}), 0)::int` })
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, article.id)),
      tx
        .select({ eventId: newsEventArticles.eventId })
        .from(newsEventArticles)
        .where(eq(newsEventArticles.articleId, article.id))
        .orderBy(newsEventArticles.createdAt)
        .limit(1),
    ]);
    const [revision] = await tx
      .insert(articleRevisions)
      .values({
        articleId: article.id,
        revisionNumber: (counter[0]?.maximum ?? 0) + 1,
        contentHash,
        snapshot,
        createdBy: actor.userId,
        sourceEventId: sourceLink[0]?.eventId ?? null,
      })
      .returning();
    if (!revision) {
      throw new PublicationError('CONFLICT', 409, 'Article revision could not be created.');
    }
    return { article, revision };
  });
}

export async function getArticlePublicationStatus(
  articleIdInput: string,
): Promise<ArticlePublicationStatus> {
  const articleId = parseInput(articleIdSchema, articleIdInput);
  const database = requireDatabase();
  await ensureBootstrapped();
  const [article] = await database
    .select()
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new PublicationError('NOT_FOUND', 404, 'Article not found.');

  const publishedRevisionRows = article.publishedRevisionId
    ? await database
        .select()
        .from(articleRevisions)
        .where(
          and(
            eq(articleRevisions.id, article.publishedRevisionId),
            eq(articleRevisions.articleId, article.id),
          ),
        )
        .limit(1)
    : [];

  let draftHash: string | null = null;
  let draftValidationError: string | null = null;
  try {
    draftHash = hashArticlePublicationSnapshot(articlePublicationSnapshotFromArticle(article));
  } catch (error) {
    draftValidationError =
      error instanceof ZodError
        ? error.issues[0]?.message ?? 'The editable article is not publication-ready.'
        : 'The editable article could not be canonicalized.';
  }

  const mediaId = draftHash ? articleHeroMediaAssetId(article.hero) : null;
  if (draftHash && article.hero && !mediaId) {
    draftHash = null;
    draftValidationError =
      'Publication heroes must use an approved BB Sports media-library asset with durable immutable bytes.';
  } else if (mediaId) {
    const [asset] = await database
      .select({
        kind: mediaAssets.kind,
        status: mediaAssets.status,
        contentType: mediaAssets.contentType,
        approved: mediaAssets.approved,
        hasBytes: sql<boolean>`length(${mediaAssets.dataBase64}) > 0`,
      })
      .from(mediaAssets)
      .where(eq(mediaAssets.id, mediaId))
      .limit(1);
    const issue = heroMediaReadinessError(asset);
    if (issue) {
      draftHash = null;
      draftValidationError = issue;
    }
  }

  const publishedRevision = publishedRevisionRows[0] ?? null;
  const liveArticle = article.published
    ? materializePublishedArticle(article, publishedRevision)
    : null;
  if (article.published && !liveArticle) {
    throw new PublicationError(
      'CONFLICT',
      409,
      'The live article pointer failed its immutable content-integrity check.',
    );
  }
  if (
    !article.published &&
    (article.publishedAt ||
      article.publishedSnapshot ||
      article.publishedContentHash ||
      article.publishedRevisionId)
  ) {
    throw new PublicationError(
      'CONFLICT',
      409,
      'The draft article retained an invalid live publication pointer.',
    );
  }
  if (publishedRevision) validatedRevisionSnapshot(publishedRevision);
  return {
    published: article.published,
    draftHash,
    draftValidationError,
    currentPublishedHash: article.published ? article.publishedContentHash : null,
    currentPublishedRevisionId: article.published ? article.publishedRevisionId : null,
    hasUnpublishedChanges:
      !article.published || !draftHash || draftHash !== article.publishedContentHash,
    publishedSlug: liveArticle?.slug ?? null,
    publishedRevisionNumber: publishedRevision?.revisionNumber ?? null,
  };
}

export async function publishArticleRevision(
  requestInput: ArticlePublishRequest,
  actorInput: ArticlePublicationActor,
): Promise<ArticlePublishResult> {
  const request = parseInput(articlePublishRequestSchema, requestInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  try {
    return await database.transaction(async (tx) => {
    const actor = await requireCurrentActor(tx, actorInput, { superAdmin: true });
    const article = await lockArticle(tx, request.articleId);
    const [revision] = await tx
      .select()
      .from(articleRevisions)
      .where(
        and(
          eq(articleRevisions.id, request.expectedRevisionId),
          eq(articleRevisions.articleId, article.id),
        ),
      )
      .limit(1);
    if (!revision) {
      throw new PublicationError('NOT_FOUND', 404, 'The selected article revision was not found.');
    }
    const revisionSnapshot = validatedRevisionSnapshot(revision);
    if (
      revision.contentHash !== request.expectedContentHash ||
      hashArticlePublicationSnapshot(revisionSnapshot) !== request.expectedContentHash
    ) {
      throw new PublicationError('CONFLICT', 409, 'The approved revision hash no longer matches.');
    }
    // Editorial integrity: fact-heavy prose needs citations or opinion-only stamp.
    const sourceGate = evaluatePublishSourceGate({
      body: revisionSnapshot.body,
      title: revisionSnapshot.title,
      rationale: request.rationale,
    });
    if (!sourceGate.ok) {
      throw new PublicationError('VALIDATION', 400, sourceGate.reason);
    }

    let editableSnapshot: ArticlePublicationSnapshot;
    try {
      editableSnapshot = articlePublicationSnapshotFromArticle(article);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new PublicationError(
          'VALIDATION',
          400,
          error.issues[0]?.message ?? 'The editable article is not publication-ready.',
        );
      }
      throw error;
    }
    const editableHash = hashArticlePublicationSnapshot(editableSnapshot);
    if (
      editableHash !== request.expectedContentHash ||
      JSON.stringify(editableSnapshot) !== JSON.stringify(revisionSnapshot)
    ) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'The article changed after this revision was created; create and approve a fresh revision.',
      );
    }
    // Recheck and share-lock generated image readiness at the exact publication
    // boundary. The media update path takes a conflicting row lock, so an
    // unapproval cannot race this snapshot into a broken public hero.
    await assertHeroMediaPublicationReady(tx, revisionSnapshot.hero);
    if (
      article.published &&
      article.publishedRevisionId === revision.id &&
      article.publishedContentHash === revision.contentHash
    ) {
      throw new PublicationError('INVALID_STATE', 409, 'This exact revision is already public.');
    }

    const [slugCollision] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(
        and(
          eq(articles.published, true),
          ne(articles.id, article.id),
          sql`${articles.publishedSnapshot}->>'slug' = ${revisionSnapshot.slug}`,
        ),
      )
      .limit(1);
    if (slugCollision) {
      throw new PublicationError('CONFLICT', 409, 'Another live article already owns this public slug.');
    }

    await assertLinkedEventsRemainVerified(tx, article.id);
    // Authorize only this fully verified transaction to cross the DB-level
    // rolling-deploy publication-state guard. Old replicas never set it.
    await tx.execute(
      sql`SELECT set_config('bbsports.article_publication_contract', 'v1', true)`,
    );
    const publishedAt = new Date();
    const [updatedArticle] = await tx
      .update(articles)
      .set({
        published: true,
        publishedAt,
        publishedSnapshot: revisionSnapshot,
        publishedContentHash: revision.contentHash,
        publishedRevisionId: revision.id,
        updatedAt: publishedAt,
      })
      // The row is already FOR UPDATE locked and its exact editable snapshot
      // was re-hashed above. Avoid comparing a JS millisecond Date to a
      // Postgres microsecond timestamptz, which can false-conflict.
      .where(eq(articles.id, article.id))
      .returning();
    if (!updatedArticle) {
      throw new PublicationError('CONFLICT', 409, 'The article changed during publication.');
    }

    const [publicationEvent] = await tx
      .insert(articlePublicationEvents)
      .values({
        articleId: article.id,
        revisionId: revision.id,
        contentHash: revision.contentHash,
        action: 'published',
        actorUserId: actor.userId,
        actorLabel: actor.label,
        exactConfirmation: ARTICLE_PUBLICATION_CONFIRMATION_PHRASE,
        rationale: request.rationale,
      })
      .returning();
    if (!publicationEvent) {
      throw new PublicationError('CONFLICT', 409, 'The publication audit event could not be recorded.');
    }
      return { article: updatedArticle, revision, publicationEvent };
    });
  } catch (error) {
    if (
      isPostgresConstraintViolation(
        error,
        '23505',
        'idx_articles_live_snapshot_slug',
      )
    ) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'Another live article won this public slug; choose a different slug and prepare a fresh revision.',
      );
    }
    throw error;
  }
}

export async function unpublishArticle(
  articleIdInput: string,
  rationaleInput: string,
  actorInput: ArticlePublicationActor,
): Promise<ArticlePublishResult> {
  const articleId = parseInput(articleIdSchema, articleIdInput);
  const rationale = parseInput(unpublishRationaleSchema, rationaleInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  return database.transaction(async (tx) => {
    const actor = await requireCurrentActor(tx, actorInput, { superAdmin: true });
    const article = await lockArticle(tx, articleId);
    if (
      !article.published ||
      !article.publishedRevisionId ||
      !article.publishedContentHash ||
      !article.publishedSnapshot
    ) {
      throw new PublicationError('INVALID_STATE', 409, 'Article is not currently public.');
    }
    const [revision] = await tx
      .select()
      .from(articleRevisions)
      .where(
        and(
          eq(articleRevisions.id, article.publishedRevisionId),
          eq(articleRevisions.articleId, article.id),
        ),
      )
      .limit(1);
    if (!revision) {
      throw new PublicationError('CONFLICT', 409, 'The current immutable revision is missing.');
    }
    const revisionSnapshot = validatedRevisionSnapshot(revision);
    const publishedSnapshot = articlePublicationSnapshotSchema.safeParse(
      article.publishedSnapshot,
    );
    if (
      !publishedSnapshot.success ||
      revision.contentHash !== article.publishedContentHash ||
      hashArticlePublicationSnapshot(publishedSnapshot.data) !== article.publishedContentHash ||
      JSON.stringify(revisionSnapshot) !== JSON.stringify(publishedSnapshot.data)
    ) {
      throw new PublicationError('CONFLICT', 409, 'The current publication pointer failed integrity checks.');
    }

    await tx.execute(
      sql`SELECT set_config('bbsports.article_publication_contract', 'v1', true)`,
    );
    const unpublishedAt = new Date();
    const [updatedArticle] = await tx
      .update(articles)
      .set({
        published: false,
        publishedAt: null,
        publishedSnapshot: null,
        publishedContentHash: null,
        publishedRevisionId: null,
        updatedAt: unpublishedAt,
      })
      .where(
        and(
          eq(articles.id, article.id),
          eq(articles.published, true),
          eq(articles.publishedRevisionId, revision.id),
        ),
      )
      .returning();
    if (!updatedArticle) {
      throw new PublicationError('CONFLICT', 409, 'The article changed during unpublication.');
    }
    const [publicationEvent] = await tx
      .insert(articlePublicationEvents)
      .values({
        articleId: article.id,
        revisionId: revision.id,
        contentHash: revision.contentHash,
        action: 'unpublished',
        actorUserId: actor.userId,
        actorLabel: actor.label,
        exactConfirmation: '',
        rationale,
      })
      .returning();
    if (!publicationEvent) {
      throw new PublicationError('CONFLICT', 409, 'The unpublication audit event could not be recorded.');
    }
    return { article: updatedArticle, revision, publicationEvent };
  });
}

function deterministicEventSlug(baseSlug: string, eventId: string): string {
  const suffix = eventId.replace(/-/g, '').toLocaleLowerCase('en-US');
  const prefix = baseSlug.slice(0, 200 - suffix.length - 1).replace(/-+$/g, '') || 'story';
  return `${prefix}-${suffix}`;
}

/**
 * Permanently remove only a never-published draft with no immutable or
 * newsroom history. The current super-admin role and the article are locked in
 * the same transaction, so a concurrent role revocation cannot race deletion.
 */
export async function deleteVirginArticleDraft(
  articleIdInput: string,
  actorInput: ArticlePublicationActor,
): Promise<boolean> {
  const articleId = parseInput(articleIdSchema, articleIdInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  return database.transaction(async (tx) => {
    await requireCurrentActor(tx, actorInput, { superAdmin: true });
    const current = await lockArticle(tx, articleId);
    if (
      current.published ||
      current.publishedAt ||
      current.publishedSnapshot ||
      current.publishedContentHash ||
      current.publishedRevisionId ||
      !current.createdUnderApprovalGate
    ) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'Only a never-published draft can be permanently deleted.',
      );
    }

    const [revisionRows, publicationEventRows, sourceLinkRows, commentRows] = await Promise.all([
      tx
        .select({ id: articleRevisions.id })
        .from(articleRevisions)
        .where(eq(articleRevisions.articleId, articleId))
        .limit(1),
      tx
        .select({ id: articlePublicationEvents.id })
        .from(articlePublicationEvents)
        .where(eq(articlePublicationEvents.articleId, articleId))
        .limit(1),
      tx
        .select({ id: newsEventArticles.id })
        .from(newsEventArticles)
        .where(eq(newsEventArticles.articleId, articleId))
        .limit(1),
      tx
        .select({ id: comments.id })
        .from(comments)
        .where(eq(comments.articleId, articleId))
        .limit(1),
    ]);
    if (revisionRows[0] || publicationEventRows[0] || sourceLinkRows[0] || commentRows[0]) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'An audit-preserved article draft cannot be permanently deleted.',
      );
    }

    // The early rolling-deploy compatibility trigger rejects every legacy
    // article DELETE. Only this fully checked transaction receives the local
    // capability marker, and PostgreSQL clears it automatically at commit.
    await tx.execute(
      sql`SELECT set_config('bbsports.article_delete_contract', 'v1', true)`,
    );
    const rows = await tx
      .delete(articles)
      .where(
        and(
          eq(articles.id, articleId),
          eq(articles.published, false),
          isNull(articles.publishedAt),
          isNull(articles.publishedSnapshot),
          isNull(articles.publishedContentHash),
          isNull(articles.publishedRevisionId),
        ),
      )
      .returning({ id: articles.id });
    if (!rows[0]) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'The article changed before it could be safely deleted.',
      );
    }
    return true;
  });
}

export async function createVerifiedEventArticleDraft(
  eventIdInput: string,
  actorInput: ArticlePublicationActor,
): Promise<VerifiedEventArticleDraftResult> {
  const eventId = parseInput(articleIdSchema, eventIdInput);
  const database = requireDatabase();
  await ensureBootstrapped();

  return database.transaction(async (tx) => {
    const actor = await requireCurrentActor(tx, actorInput, { superAdmin: false });
    await tx.execute(sql`SELECT id FROM news_events WHERE id = ${eventId} FOR UPDATE`);
    const [event] = await tx
      .select()
      .from(newsEvents)
      .where(eq(newsEvents.id, eventId))
      .limit(1);
    if (!event) throw new PublicationError('NOT_FOUND', 404, 'Newsroom event not found.');
    if (event.state !== 'verified') {
      throw new PublicationError(
        'VERIFICATION_FAILED',
        422,
        'Only a currently verified newsroom event can seed an article draft.',
      );
    }

    const evidence = await tx
      .select()
      .from(newsEvidence)
      .where(eq(newsEvidence.eventId, event.id))
      .orderBy(newsEvidence.createdAt)
      .limit(501);
    if (evidence.length > 500) {
      throw new PublicationError('CONFLICT', 409, 'Evidence exceeds the safe draft-review bound.');
    }
    const assessment = assessNewsVerification(evidence);
    await assertActiveEvidenceSourcesApproved(tx, activeEvidence(evidence));
    if (!assessment.passes) {
      throw new PublicationError(
        'VERIFICATION_FAILED',
        422,
        assessment.reason === 'contradiction_present'
          ? 'Fresh contradictory evidence blocks article drafting.'
          : 'Fresh evidence no longer satisfies the newsroom verification threshold.',
      );
    }

    // Event row locking makes this idempotency check race-safe.
    const [existing] = await tx
      .select({
        link: newsEventArticles,
        article: articles,
        revision: articleRevisions,
      })
      .from(newsEventArticles)
      .innerJoin(articles, eq(articles.id, newsEventArticles.articleId))
      .innerJoin(articleRevisions, eq(articleRevisions.id, newsEventArticles.revisionId))
      .where(
        and(
          eq(newsEventArticles.eventId, event.id),
          eq(newsEventArticles.relation, 'source'),
        ),
      )
      .limit(1);
    if (existing) {
      validatedRevisionSnapshot(existing.revision);
      return { ...existing, created: false };
    }

    let snapshot: ArticlePublicationSnapshot;
    try {
      snapshot = createVerifiedNewsroomArticleDraft({
        event,
        activeEvidence: activeEvidence(evidence).map((item) => ({
          stance: z.enum(['supporting', 'contradicting', 'context']).parse(item.stance),
          label: item.label,
          url: item.url,
          evidenceClass: z
            .enum(['primary', 'official', 'reporting', 'context'])
            .parse(item.evidenceClass),
          sourceTier: z
            .enum(['primary', 'official', 'tier_1', 'tier_2', 'unverified'])
            .parse(item.sourceTier),
          ownerKey: item.ownerKey,
          credible: item.credible,
        })),
      });
    } catch (error) {
      if (error instanceof ArticlePublicationInvariantError) {
        throw new PublicationError('VERIFICATION_FAILED', 422, error.message);
      }
      if (error instanceof ZodError) {
        throw new PublicationError(
          'VALIDATION',
          400,
          error.issues[0]?.message ?? 'The verified event cannot form a safe article draft.',
        );
      }
      throw error;
    }

    // Every newsroom-created slug includes the immutable event id. This avoids
    // a check-then-insert race when two verified events have the same headline
    // while keeping retries deterministic under the event row lock above.
    snapshot = normalizeArticlePublicationSnapshot({
      ...snapshot,
      slug: deterministicEventSlug(snapshot.slug, event.id),
    });

    const contentHash = hashArticlePublicationSnapshot(snapshot);
    const [article] = await tx
      .insert(articles)
      .values({
        slug: snapshot.slug,
        title: snapshot.title,
        dek: snapshot.dek,
        body: snapshot.body,
        sport: snapshot.sport,
        hero: snapshot.hero,
        heroAlt: snapshot.heroAlt,
        heroCredit: snapshot.heroCredit,
        authorId: actor.userId,
        authorName: snapshot.authorName,
        aiAssisted: snapshot.aiAssisted,
        bradsTake: snapshot.bradsTake,
        createdUnderApprovalGate: true,
        published: false,
      })
      .onConflictDoNothing({ target: articles.slug })
      .returning();
    if (!article) {
      throw new PublicationError(
        'CONFLICT',
        409,
        'The deterministic newsroom article slug is already occupied.',
      );
    }
    const [revision] = await tx
      .insert(articleRevisions)
      .values({
        articleId: article.id,
        revisionNumber: 1,
        contentHash,
        snapshot,
        createdBy: actor.userId,
        sourceEventId: event.id,
      })
      .returning();
    if (!revision) throw new PublicationError('CONFLICT', 409, 'Draft revision could not be created.');
    const [link] = await tx
      .insert(newsEventArticles)
      .values({
        eventId: event.id,
        articleId: article.id,
        revisionId: revision.id,
        relation: 'source',
        actorUserId: actor.userId,
        actorLabel: actor.label,
      })
      .returning();
    if (!link) throw new PublicationError('CONFLICT', 409, 'Newsroom article link could not be created.');

    await tx.insert(newsroomActivity).values({
      eventId: event.id,
      actorUserId: actor.userId,
      actorLabel: actor.label,
      action: 'article.draft_created',
      fromState: event.state,
      toState: event.state,
      summary: `Verified event article draft created: ${snapshot.title}`.slice(0, 500),
      metadata: {
        articleId: article.id,
        revisionId: revision.id,
        contentHash,
      },
    });
    return { article, revision, link, created: true };
  });
}
