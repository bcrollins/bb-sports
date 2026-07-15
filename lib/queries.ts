/**
 * BB Sports — high-level data access. Used by both public pages and admin routes.
 *
 * All queries trigger `ensureBootstrapped()` first so the DB is always ready before
 * the first read. If DATABASE_URL is missing (local dev with no Postgres), every
 * accessor returns an empty result so the public site degrades gracefully instead
 * of crashing.
 */
import { randomBytes } from 'node:crypto';
import { and, asc, desc, eq, gt, lt, ne, sql, type SQL } from 'drizzle-orm';
import { db, dbAvailable } from './db/client';
import {
  articles,
  articleRevisions,
  comments,
  contactMessages,
  donationIntents,
  mediaAssets,
  newsletterSubscribers,
  publicationRuntimeControls,
  siteConfig,
  type Article,
  type Comment,
  type ContactMessage,
  type DonationIntent,
  type MediaAsset,
  type NewsletterSubscriber,
} from './db/schema';
import { ensureBootstrapped } from './db/bootstrap';
import { moderateComment } from './comment-moderation';
import type { CommentCreateInput, CommentStatus } from './comment-validation';
import { assertAuthAttemptAllowed, recordAuthFailure } from './auth-rate-limit';
import { hashArticleEditableState } from './article-publication';
import {
  isPostgresConstraintViolation,
  materializePublishedArticle,
  PublicationError,
} from './article-publication-queries';

// ---------- articles ----------

export async function getPublishedArticles(): Promise<Article[]> {
  if (!db) return [];
  await ensureBootstrapped();
  // Archive, search, RSS, and sitemap require one exact canonical catalog.
  // One MVCC statement prevents concurrent publish/unpublish operations from
  // shifting rows between pages and making a story disappear or duplicate.
  const rows = await db
    .select({ article: articles, revision: articleRevisions })
    .from(articles)
    .innerJoin(
      articleRevisions,
      and(
        eq(articleRevisions.id, articles.publishedRevisionId),
        eq(articleRevisions.articleId, articles.id),
        eq(articleRevisions.contentHash, articles.publishedContentHash),
      ),
    )
    .where(
      and(
        eq(articles.published, true),
        sql`${articles.publishedSnapshot} IS NOT NULL`,
      ),
    )
    .orderBy(desc(articles.publishedAt), desc(articles.id));
  return rows
    .map((row) => materializePublishedArticle(row.article, row.revision))
    .filter((article): article is Article => Boolean(article));
}

export async function getAllArticles(): Promise<Article[]> {
  if (!db) return [];
  await ensureBootstrapped();
  return db
    .select()
    .from(articles)
    .orderBy(desc(articles.updatedAt));
}

export type AdminArticleRosterRow = {
  article: Article;
  /** Present only when every immutable live pointer, revision, hash, and snapshot check passes. */
  liveArticle: Article | null;
  /** True only when no immutable revision, publication event, or newsroom link exists. */
  canDeleteVirginDraft: boolean;
};

/**
 * Admin roster read with the same fail-closed immutable materialization used by
 * public delivery. A truthy JSON snapshot alone is never treated as proof that
 * an article is live.
 */
export async function getAllArticlesForAdmin(): Promise<AdminArticleRosterRow[]> {
  if (!db) return [];
  await ensureBootstrapped();
  const rows = await db
    .select({
      article: articles,
      revision: articleRevisions,
      hasHistory: sql<boolean>`
        EXISTS (SELECT 1 FROM article_revisions history_revision WHERE history_revision.article_id = ${articles.id})
        OR EXISTS (SELECT 1 FROM article_publication_events history_event WHERE history_event.article_id = ${articles.id})
        OR EXISTS (SELECT 1 FROM news_event_articles history_link WHERE history_link.article_id = ${articles.id})
        OR EXISTS (SELECT 1 FROM comments history_comment WHERE history_comment.article_id = ${articles.id})
      `,
    })
    .from(articles)
    .leftJoin(
      articleRevisions,
      and(
        eq(articleRevisions.id, articles.publishedRevisionId),
        eq(articleRevisions.articleId, articles.id),
      ),
    )
    .orderBy(desc(articles.updatedAt));

  return rows.map(({ article, revision, hasHistory }) => ({
    article,
    liveArticle: article.published
      ? materializePublishedArticle(article, revision)
      : null,
    canDeleteVirginDraft:
      !article.published &&
      !article.publishedAt &&
      !article.publishedSnapshot &&
      !article.publishedContentHash &&
      !article.publishedRevisionId &&
      article.createdUnderApprovalGate &&
      !hasHistory,
  }));
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  if (!db) return null;
  await ensureBootstrapped();
  const rows = await db
    .select()
    .from(articles)
    .where(eq(articles.slug, slug))
    .limit(1);
  return rows[0] ?? null;
}

export async function getArticleById(id: string): Promise<Article | null> {
  if (!db) return null;
  await ensureBootstrapped();
  const rows = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getPublishedArticleBySlug(slug: string): Promise<Article | null> {
  if (!db) return null;
  await ensureBootstrapped();
  const [article] = await db
    .select({ article: articles, revision: articleRevisions })
    .from(articles)
    .innerJoin(
      articleRevisions,
      and(
        eq(articleRevisions.id, articles.publishedRevisionId),
        eq(articleRevisions.articleId, articles.id),
        eq(articleRevisions.contentHash, articles.publishedContentHash),
      ),
    )
    .where(
      and(
        eq(articles.published, true),
        sql`${articles.publishedSnapshot}->>'slug' = ${slug}`,
      ),
    )
    .limit(1);
  return article
    ? materializePublishedArticle(article.article, article.revision)
    : null;
}

// ---------- site_config ----------

export async function getConfig<T = unknown>(key: string, fallback: T): Promise<T> {
  if (!db) return fallback;
  await ensureBootstrapped();
  const rows = await db
    .select()
    .from(siteConfig)
    .where(eq(siteConfig.key, key))
    .limit(1);
  return (rows[0]?.value as T) ?? fallback;
}

export async function setConfig(key: string, value: unknown, updatedBy?: string | null) {
  if (!db) return;
  await db
    .insert(siteConfig)
    .values({ key, value, updatedBy: updatedBy ?? null })
    .onConflictDoUpdate({
      target: siteConfig.key,
      set: { value, updatedAt: new Date(), updatedBy: updatedBy ?? null },
    });
}

// ---------- mutations (used by admin routes) ----------

export async function createArticle(input: {
  slug: string;
  title: string;
  dek?: string;
  body?: string;
  sport?: string;
  hero?: string;
  heroAlt?: string;
  heroCredit?: string;
  authorId?: string | null;
  authorName?: string;
  aiAssisted?: boolean;
  bradsTake?: string;
  published?: boolean;
}): Promise<Article> {
  if (!db) throw new Error('Database not available');
  if (input.published === true) {
    throw new PublicationError(
      'FORBIDDEN',
      403,
      'New articles must begin as drafts and use Brad\'s explicit approval flow.',
    );
  }
  await ensureBootstrapped();
  const rows = await db
    .insert(articles)
    .values({
      slug: input.slug,
      title: input.title,
      dek: input.dek ?? '',
      body: input.body ?? '',
      sport: input.sport ?? 'Op-Ed',
      hero: input.hero ?? '',
      heroAlt: input.heroAlt ?? '',
      heroCredit: input.heroCredit ?? '',
      authorId: input.authorId ?? undefined,
      authorName: input.authorName ?? 'Brad Benson',
      aiAssisted: Boolean(input.aiAssisted),
      bradsTake: input.bradsTake ?? '',
      createdUnderApprovalGate: true,
      published: false,
      publishedAt: null,
    })
    .returning();
  return rows[0];
}

export async function updateArticle(
  id: string,
  patch: Partial<{
    slug: string;
    title: string;
    dek: string;
    body: string;
    sport: string;
    hero: string;
    heroAlt: string;
    heroCredit: string;
    authorName: string;
    aiAssisted: boolean;
    bradsTake: string;
    published: boolean;
  }>,
  expectedEditToken: string,
): Promise<Article | null> {
  if (!db) throw new Error('Database not available');
  if (Object.hasOwn(patch, 'published')) {
    throw new PublicationError(
      'FORBIDDEN',
      403,
      'Publishing and unpublishing require Brad\'s immutable approval workflow.',
    );
  }
  if (!/^[a-f0-9]{64}$/.test(expectedEditToken)) {
    throw new PublicationError(
      'VALIDATION',
      400,
      'A valid article edit precondition is required.',
    );
  }
  await ensureBootstrapped();
  try {
    return await db.transaction(async (tx) => {
      // Lock the release gate before the article. The disable command takes
      // this row FOR UPDATE, waits for every in-flight edit, and then evaluates
      // live drift with a fresh statement snapshot. This fixed lock order also
      // prevents edit/rollback deadlocks.
      const [workingCopyControl] = await tx
        .select({ enabled: publicationRuntimeControls.enabled })
        .from(publicationRuntimeControls)
        .where(
          eq(
            publicationRuntimeControls.controlKey,
            'published_working_copy_edits_v1',
          ),
        )
        .limit(1)
        .for('share');
      await tx.execute(sql`SELECT id FROM articles WHERE id = ${id} FOR UPDATE`);
      const [current] = await tx
        .select()
        .from(articles)
        .where(eq(articles.id, id))
        .limit(1);
      if (!current) return null;
      if (hashArticleEditableState(current) !== expectedEditToken) {
        throw new PublicationError(
          'CONFLICT',
          409,
          'This draft changed in another session. Reload before saving so no work is overwritten.',
        );
      }
      if (current.published) {
        if (!workingCopyControl?.enabled) {
          throw new PublicationError(
            'RELEASE_CONVERGENCE',
            503,
            'Published working-copy edits are temporarily paused while the release converges. Retry after all prior readers have drained.',
          );
        }
      }
      // The early database trigger rejects published-row edits from older
      // rolling-deploy instances. Enable its capability transaction-locally only
      // after this request has locked the row and passed the exact edit CAS.
      await tx.execute(sql`
        SELECT set_config(
          'bbsports.published_working_copy_edit_contract',
          'v1',
          true
        )
      `);
      const [updated] = await tx
        .update(articles)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(articles.id, id))
        .returning();
      return updated ?? null;
    });
  } catch (error) {
    if (
      isPostgresConstraintViolation(
        error,
        '55000',
        'articles_published_working_copy_edit_contract',
      )
    ) {
      throw new PublicationError(
        'RELEASE_CONVERGENCE',
        503,
        'Published working-copy edits are temporarily paused while the release converges. Retry after all prior readers have drained.',
      );
    }
    throw error;
  }
}

export async function adjacentArticles(
  publishedAt: Date | null,
): Promise<{ prev: Article | null; next: Article | null }> {
  if (!db || !publishedAt) return { prev: null, next: null };
  await ensureBootstrapped();
  // Single-row scans, indexed by (published, published_at DESC) — cheaper
  // than the previous 50-row fetch + JS filter.
  const [prevRows, nextRows] = await Promise.all([
    db
      .select({ article: articles, revision: articleRevisions })
      .from(articles)
      .innerJoin(
        articleRevisions,
        and(
          eq(articleRevisions.id, articles.publishedRevisionId),
          eq(articleRevisions.articleId, articles.id),
          eq(articleRevisions.contentHash, articles.publishedContentHash),
        ),
      )
      .where(and(eq(articles.published, true), lt(articles.publishedAt, publishedAt)))
      .orderBy(desc(articles.publishedAt))
      .limit(25),
    db
      .select({ article: articles, revision: articleRevisions })
      .from(articles)
      .innerJoin(
        articleRevisions,
        and(
          eq(articleRevisions.id, articles.publishedRevisionId),
          eq(articleRevisions.articleId, articles.id),
          eq(articleRevisions.contentHash, articles.publishedContentHash),
        ),
      )
      .where(and(eq(articles.published, true), gt(articles.publishedAt, publishedAt)))
      .orderBy(asc(articles.publishedAt))
      .limit(25),
  ]);
  return {
    prev:
      prevRows
        .map((row) => materializePublishedArticle(row.article, row.revision))
        .find(Boolean) ?? null,
    next:
      nextRows
        .map((row) => materializePublishedArticle(row.article, row.revision))
        .find(Boolean) ?? null,
  };
}

/**
 * Same-sport related: pulls the most-recent published articles in the same
 * sport, excluding the current one. Used when DATABASE_URL is set; the
 * filesystem fallback in lib/articles.ts handles the no-DB case separately.
 */
export async function getRelatedArticlesBySport(
  currentId: string,
  sport: string,
  limit: number,
): Promise<Article[]> {
  if (!db) return [];
  await ensureBootstrapped();
  const safeLimit = Number.isInteger(limit) ? Math.min(Math.max(limit, 1), 50) : 6;
  const rows = await db
    .select({ article: articles, revision: articleRevisions })
    .from(articles)
    .innerJoin(
      articleRevisions,
      and(
        eq(articleRevisions.id, articles.publishedRevisionId),
        eq(articleRevisions.articleId, articles.id),
        eq(articleRevisions.contentHash, articles.publishedContentHash),
      ),
    )
    .where(and(
      eq(articles.published, true),
      sql`${articles.publishedSnapshot}->>'sport' = ${sport}`,
      ne(articles.id, currentId),
    ))
    .orderBy(desc(articles.publishedAt))
    .limit(Math.min(safeLimit * 4, 200));
  return rows
    .map((row) => materializePublishedArticle(row.article, row.revision))
    .filter((article): article is Article => Boolean(article))
    .slice(0, safeLimit);
}

// ---------- audience / intake ledgers ----------

export function createNewsletterUnsubscribeToken(): string {
  return randomBytes(24).toString('hex');
}

export async function upsertNewsletterSubscriber(input: {
  email: string;
  source?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<NewsletterSubscriber> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const unsubscribeToken = createNewsletterUnsubscribeToken();
  const rows = await db
    .insert(newsletterSubscribers)
    .values({
      email: input.email,
      unsubscribeToken,
      source: input.source ?? 'site',
      lastIpAddress: input.ip ?? null,
      lastUserAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: {
        status: 'subscribed',
        source: input.source ?? 'site',
        unsubscribeToken: sql`coalesce(${newsletterSubscribers.unsubscribeToken}, ${unsubscribeToken})`,
        lastIpAddress: input.ip ?? null,
        lastUserAgent: input.userAgent ?? null,
        unsubscribedAt: null,
        welcomeError: null,
        updatedAt: new Date(),
        signupCount: sql`${newsletterSubscribers.signupCount} + 1`,
      },
    })
    .returning();
  return rows[0];
}

export async function markNewsletterWelcomeDelivered(input: {
  id: string;
  providerId: string;
}): Promise<NewsletterSubscriber | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .update(newsletterSubscribers)
    .set({
      welcomeSentAt: new Date(),
      welcomeProviderId: input.providerId,
      welcomeError: null,
      updatedAt: new Date(),
    })
    .where(eq(newsletterSubscribers.id, input.id))
    .returning();
  return rows[0] ?? null;
}

export async function markNewsletterWelcomeFailed(input: {
  id: string;
  error: string;
}): Promise<NewsletterSubscriber | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .update(newsletterSubscribers)
    .set({
      welcomeError: input.error.slice(0, 1000),
      updatedAt: new Date(),
    })
    .where(eq(newsletterSubscribers.id, input.id))
    .returning();
  return rows[0] ?? null;
}

/** Read-only lookup. Never mutates consent — used by GET scanners and confirmation UI. */
export async function getNewsletterSubscriberByToken(
  token: string,
): Promise<NewsletterSubscriber | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .select()
    .from(newsletterSubscribers)
    .where(eq(newsletterSubscribers.unsubscribeToken, token))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Suppress a subscriber by opaque token. Idempotent: already-unsubscribed
 * tokens still return the row so one-click POST can safely 200.
 */
export async function unsubscribeNewsletterSubscriber(token: string): Promise<NewsletterSubscriber | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const existing = await getNewsletterSubscriberByToken(token);
  if (!existing) return null;
  if (existing.status === 'unsubscribed') return existing;
  const rows = await db
    .update(newsletterSubscribers)
    .set({
      status: 'unsubscribed',
      unsubscribedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(newsletterSubscribers.unsubscribeToken, token))
    .returning();
  return rows[0] ?? null;
}

export async function createContactMessage(input: {
  mode: string;
  email: string;
  name?: string;
  message: string;
  confidential?: boolean;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<ContactMessage> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .insert(contactMessages)
    .values({
      mode: input.mode,
      email: input.email,
      name: input.name ?? '',
      message: input.message,
      confidential: Boolean(input.confidential),
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();
  return rows[0];
}

export async function createDonationIntent(input: {
  email?: string | null;
  name?: string;
  amountCents?: number | null;
  message?: string;
  source?: string;
  status?: string;
  stripePaymentLink?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;
  stripeCurrency?: string | null;
  stripeAmountReceivedCents?: number | null;
  paidAt?: Date | null;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<DonationIntent> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .insert(donationIntents)
    .values({
      email: input.email ?? null,
      name: input.name ?? '',
      amountCents: input.amountCents ?? null,
      message: input.message ?? '',
      source: input.source ?? 'site',
      status: input.status ?? 'waiting_for_stripe',
      stripePaymentLink: input.stripePaymentLink ?? null,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripePaymentIntentId: input.stripePaymentIntentId ?? null,
      stripeCustomerId: input.stripeCustomerId ?? null,
      stripeCurrency: input.stripeCurrency ?? null,
      stripeAmountReceivedCents: input.stripeAmountReceivedCents ?? null,
      paidAt: input.paidAt ?? null,
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateDonationIntentStripeCheckout(input: {
  id: string;
  status: string;
  stripeCheckoutSessionId?: string | null;
  stripePaymentLink?: string | null;
}): Promise<DonationIntent | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .update(donationIntents)
    .set({
      status: input.status,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId ?? null,
      stripePaymentLink: input.stripePaymentLink ?? null,
      updatedAt: new Date(),
    })
    .where(eq(donationIntents.id, input.id))
    .returning();
  return rows[0] ?? null;
}

export async function updateDonationIntentStripeStatus(input: {
  id?: string | null;
  stripeCheckoutSessionId?: string | null;
  status: string;
  stripePaymentIntentId?: string | null;
  stripeCustomerId?: string | null;
  stripeCurrency?: string | null;
  stripeAmountReceivedCents?: number | null;
  paidAt?: Date | null;
}): Promise<DonationIntent | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const where = input.id
    ? eq(donationIntents.id, input.id)
    : input.stripeCheckoutSessionId
      ? eq(donationIntents.stripeCheckoutSessionId, input.stripeCheckoutSessionId)
      : null;
  if (!where) return null;
  const rows = await db
    .update(donationIntents)
    .set({
      status: input.status,
      stripePaymentIntentId: input.stripePaymentIntentId ?? undefined,
      stripeCustomerId: input.stripeCustomerId ?? undefined,
      stripeCurrency: input.stripeCurrency ?? undefined,
      stripeAmountReceivedCents: input.stripeAmountReceivedCents ?? undefined,
      paidAt: input.paidAt ?? undefined,
      updatedAt: new Date(),
    })
    .where(where)
    .returning();
  return rows[0] ?? null;
}

export async function getAudienceSnapshot(): Promise<{
  counts: {
    subscribers: number;
    contactNew: number;
    donationWaiting: number;
    donationOpen: number;
    donationPaid: number;
    donationFailed: number;
    donationPaidCents: number;
  };
  recentSubscribers: NewsletterSubscriber[];
  recentMessages: ContactMessage[];
  recentDonationIntents: DonationIntent[];
}> {
  if (!db) {
    return {
      counts: {
        subscribers: 0,
        contactNew: 0,
        donationWaiting: 0,
        donationOpen: 0,
        donationPaid: 0,
        donationFailed: 0,
        donationPaidCents: 0,
      },
      recentSubscribers: [],
      recentMessages: [],
      recentDonationIntents: [],
    };
  }
  await ensureBootstrapped();
  const [
    subscriberRows,
    contactRows,
    donationSummaryRows,
    recentSubscribers,
    recentMessages,
    recentDonationIntents,
  ] = await Promise.all([
    db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.status, 'subscribed')),
    db.select().from(contactMessages).where(eq(contactMessages.status, 'new')),
    db.execute(sql`
      SELECT
        count(*) FILTER (WHERE status = 'waiting_for_stripe')::int AS waiting,
        count(*) FILTER (WHERE status IN ('ready_to_pay', 'checkout_pending', 'checkout_open'))::int AS open,
        count(*) FILTER (WHERE status = 'paid')::int AS paid,
        count(*) FILTER (WHERE status IN ('checkout_failed', 'checkout_expired', 'payment_failed'))::int AS failed,
        coalesce(sum(stripe_amount_received_cents) FILTER (WHERE status = 'paid'), 0)::int AS paid_cents
      FROM donation_intents
    `),
    db
      .select()
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.updatedAt))
      .limit(8),
    db
      .select()
      .from(contactMessages)
      .orderBy(desc(contactMessages.createdAt))
      .limit(8),
    db
      .select()
      .from(donationIntents)
      .orderBy(desc(donationIntents.createdAt))
      .limit(8),
  ]);
  const donationSummary = (donationSummaryRows as unknown as Array<{
    waiting: number;
    open: number;
    paid: number;
    failed: number;
    paid_cents: number;
  }>)[0];
  return {
    counts: {
      subscribers: subscriberRows.length,
      contactNew: contactRows.length,
      donationWaiting: donationSummary?.waiting ?? 0,
      donationOpen: donationSummary?.open ?? 0,
      donationPaid: donationSummary?.paid ?? 0,
      donationFailed: donationSummary?.failed ?? 0,
      donationPaidCents: donationSummary?.paid_cents ?? 0,
    },
    recentSubscribers,
    recentMessages,
    recentDonationIntents,
  };
}

// ---------- media assets ----------

export class MediaAssetConflictError extends Error {
  readonly status = 409;

  constructor(message: string) {
    super(message);
    this.name = 'MediaAssetConflictError';
  }
}

export function publicMediaUrl(asset: Pick<MediaAsset, 'id' | 'dataBase64' | 'assetUrl' | 'externalUrl'>): string {
  if (asset.dataBase64) return `/api/media/assets/${asset.id}/file`;
  return asset.assetUrl || asset.externalUrl || '';
}

export async function getMediaAssets(options: {
  approved?: boolean;
  placement?: string;
  limit?: number;
} = {}): Promise<MediaAsset[]> {
  if (!db) return [];
  await ensureBootstrapped();
  const conditions: SQL[] = [];
  if (typeof options.approved === 'boolean') conditions.push(eq(mediaAssets.approved, options.approved));
  if (options.placement) conditions.push(eq(mediaAssets.placement, options.placement));
  const where = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  if (where) {
    return db
      .select()
      .from(mediaAssets)
      .where(where)
      .orderBy(desc(mediaAssets.updatedAt))
      .limit(options.limit ?? 24);
  }
  return db.select().from(mediaAssets).orderBy(desc(mediaAssets.updatedAt)).limit(options.limit ?? 24);
}

export async function getMediaAssetById(id: string): Promise<MediaAsset | null> {
  if (!db) return null;
  await ensureBootstrapped();
  const rows = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createMediaAsset(input: {
  kind: string;
  status?: string;
  title?: string;
  sport?: string;
  placement?: string;
  prompt?: string;
  provider?: string;
  model?: string;
  assetUrl?: string;
  externalUrl?: string;
  contentType?: string;
  dataBase64?: string;
  altText?: string;
  credit?: string;
  aspectRatio?: string;
  resolution?: string;
  durationSeconds?: number | null;
  animated?: boolean;
  approved?: boolean;
  requestId?: string | null;
  rawResponse?: unknown;
  createdBy?: string | null;
}): Promise<MediaAsset> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .insert(mediaAssets)
    .values({
      kind: input.kind,
      status: input.status ?? 'ready',
      title: input.title ?? '',
      sport: input.sport ?? 'general',
      placement: input.placement ?? 'homepage',
      prompt: input.prompt ?? '',
      provider: input.provider ?? 'xai',
      model: input.model ?? '',
      assetUrl: input.assetUrl ?? '',
      externalUrl: input.externalUrl ?? '',
      contentType: input.contentType ?? '',
      dataBase64: input.dataBase64 ?? '',
      altText: input.altText ?? '',
      credit: input.credit ?? 'AI-generated via xAI Grok; approved by BB Sports.',
      aspectRatio: input.aspectRatio ?? '16:9',
      resolution: input.resolution ?? '',
      durationSeconds: input.durationSeconds ?? null,
      animated: Boolean(input.animated),
      approved: Boolean(input.approved),
      requestId: input.requestId ?? null,
      rawResponse: input.rawResponse ?? null,
      createdBy: input.createdBy ?? null,
    })
    .returning();
  return rows[0];
}

export async function updateMediaAsset(
  id: string,
  patch: Partial<{
    status: string;
    title: string;
    sport: string;
    placement: string;
    assetUrl: string;
    externalUrl: string;
    contentType: string;
    altText: string;
    credit: string;
    approved: boolean;
    rawResponse: unknown;
  }>,
): Promise<MediaAsset | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  try {
    return await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM media_assets WHERE id = ${id} FOR UPDATE`);
      const [current] = await tx
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.id, id))
        .limit(1);
      if (!current) return null;

      if (patch.approved === false && current.approved) {
        const publicPath = `/api/media/assets/${current.id}/file`;
        const [liveReference] = await tx
          .select({ id: articles.id })
          .from(articles)
          .where(
            and(
              eq(articles.published, true),
              sql`${articles.publishedSnapshot}->>'hero' = ${publicPath}`,
            ),
          )
          .limit(1);
        if (liveReference) {
          throw new MediaAssetConflictError(
            'Unpublish every live article using this hero before unapproving the asset.',
          );
        }
      }

      const [updated] = await tx
        .update(mediaAssets)
        .set({ ...patch, updatedAt: new Date() })
        .where(eq(mediaAssets.id, id))
        .returning();
      return updated ?? null;
    });
  } catch (error) {
    if (
      isPostgresConstraintViolation(
        error,
        '23514',
        'media_assets_live_article_ready',
      )
    ) {
      throw new MediaAssetConflictError(
        'A live article requires this approved, ready image asset.',
      );
    }
    throw error;
  }
}

// ---------- comments / community ----------

export type PublicComment = {
  id: string;
  parentId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
};

export type AdminComment = {
  id: string;
  articleId: string;
  articleSlug: string;
  articleTitle: string;
  parentId: string | null;
  authorName: string;
  authorEmail: string | null;
  body: string;
  status: CommentStatus;
  moderationReason: string;
  ipAddress: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
};

function toPublicComment(comment: Comment): PublicComment {
  return {
    id: comment.id,
    parentId: comment.parentId,
    authorName: comment.authorName,
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
  };
}

async function getPublishedArticleIdBySlug(slug: string): Promise<string | null> {
  if (!db) return null;
  await ensureBootstrapped();
  const rows = await db
    .select({ article: articles, revision: articleRevisions })
    .from(articles)
    .innerJoin(
      articleRevisions,
      and(
        eq(articleRevisions.id, articles.publishedRevisionId),
        eq(articleRevisions.articleId, articles.id),
        eq(articleRevisions.contentHash, articles.publishedContentHash),
      ),
    )
    .where(
      and(
        eq(articles.published, true),
        sql`${articles.publishedSnapshot}->>'slug' = ${slug}`,
      ),
    )
    .limit(1);
  const article = rows[0]
    ? materializePublishedArticle(rows[0].article, rows[0].revision)
    : null;
  return article?.id ?? null;
}

export async function getPublicCommentsByArticleSlug(slug: string): Promise<PublicComment[]> {
  if (!db) return [];
  const articleId = await getPublishedArticleIdBySlug(slug);
  if (!articleId) return [];
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.articleId, articleId), eq(comments.status, 'approved')))
    .orderBy(asc(comments.createdAt));
  return rows.map(toPublicComment);
}

export async function createCommentForArticleSlug(input: {
  slug: string;
  comment: CommentCreateInput;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<{ status: CommentStatus; reason: string; comment: PublicComment | null }> {
  if (!db) throw new Error('Database not available');
  const articleId = await getPublishedArticleIdBySlug(input.slug);
  if (!articleId) throw new Error('Article not found');

  const ip = input.ip ?? 'unknown';
  // Durable shared rate limit (survives restarts / multi-instance).
  const rate = await assertAuthAttemptAllowed({ purpose: 'comment', ip });
  if (!rate.allowed) {
    throw new Error('Too many comments from this connection. Try again later.');
  }
  // Count this attempt toward the window (success and spam both consume budget).
  await recordAuthFailure({ purpose: 'comment', ip });

  if (input.comment.parentId) {
    const parentRows = await db
      .select({ id: comments.id })
      .from(comments)
      .where(and(
        eq(comments.id, input.comment.parentId),
        eq(comments.articleId, articleId),
        eq(comments.status, 'approved'),
      ))
      .limit(1);
    if (!parentRows[0]) throw new Error('Reply target is not available.');
  }

  const moderation = moderateComment(input.comment.body);
  const rows = await db
    .insert(comments)
    .values({
      articleId,
      parentId: input.comment.parentId ?? null,
      authorName: input.comment.authorName,
      authorEmail: input.comment.authorEmail ?? null,
      body: input.comment.body,
      status: moderation.status,
      moderationReason: moderation.reason,
      ipAddress: ip,
      userAgent: input.userAgent ?? null,
      approvedAt: moderation.status === 'approved' ? new Date() : null,
    })
    .returning();
  const row = rows[0];
  return {
    status: moderation.status,
    reason: moderation.reason,
    comment: row && moderation.status === 'approved' ? toPublicComment(row) : null,
  };
}

export async function getAdminComments(limit = 80): Promise<AdminComment[]> {
  if (!db) return [];
  await ensureBootstrapped();
  const rows = await db
    .select({
      id: comments.id,
      articleId: comments.articleId,
      articleSlug: articles.slug,
      articleTitle: articles.title,
      parentId: comments.parentId,
      authorName: comments.authorName,
      authorEmail: comments.authorEmail,
      body: comments.body,
      status: comments.status,
      moderationReason: comments.moderationReason,
      ipAddress: comments.ipAddress,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
      approvedAt: comments.approvedAt,
    })
    .from(comments)
    .innerJoin(articles, eq(comments.articleId, articles.id))
    .orderBy(desc(comments.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, status: row.status as CommentStatus }));
}

export async function getCommentModerationCounts(): Promise<Record<CommentStatus, number>> {
  const base: Record<CommentStatus, number> = { approved: 0, pending: 0, flagged: 0, spam: 0, hidden: 0 };
  if (!db) return base;
  await ensureBootstrapped();
  const rows = await db
    .select({ status: comments.status, count: sql<number>`count(*)::int` })
    .from(comments)
    .groupBy(comments.status);
  for (const row of rows) {
    if (row.status in base) base[row.status as CommentStatus] = row.count;
  }
  return base;
}

export async function updateCommentStatus(id: string, status: CommentStatus): Promise<Comment | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .update(comments)
    .set({
      status,
      approvedAt: status === 'approved' ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(comments.id, id))
    .returning();
  return rows[0] ?? null;
}

export { dbAvailable };
