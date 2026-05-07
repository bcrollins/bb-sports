/**
 * BB Sports — high-level data access. Used by both public pages and admin routes.
 *
 * All queries trigger `ensureBootstrapped()` first so the DB is always ready before
 * the first read. If DATABASE_URL is missing (local dev with no Postgres), every
 * accessor returns an empty result so the public site degrades gracefully instead
 * of crashing.
 */
import { and, asc, desc, eq, gt, lt, ne, sql } from 'drizzle-orm';
import { db, dbAvailable } from './db/client';
import {
  articles,
  contactMessages,
  donationIntents,
  newsletterSubscribers,
  siteConfig,
  type Article,
  type ContactMessage,
  type DonationIntent,
  type NewsletterSubscriber,
} from './db/schema';
import { ensureBootstrapped } from './db/bootstrap';

// ---------- articles ----------

export async function getPublishedArticles(): Promise<Article[]> {
  if (!db) return [];
  await ensureBootstrapped();
  return db
    .select()
    .from(articles)
    .where(eq(articles.published, true))
    .orderBy(desc(articles.publishedAt));
}

export async function getAllArticles(): Promise<Article[]> {
  if (!db) return [];
  await ensureBootstrapped();
  return db
    .select()
    .from(articles)
    .orderBy(desc(articles.updatedAt));
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
  const a = await getArticleBySlug(slug);
  return a && a.published ? a : null;
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
      published: Boolean(input.published),
      publishedAt: input.published ? new Date() : null,
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
): Promise<Article | null> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const current = await getArticleById(id);
  if (!current) return null;
  const willPublish = patch.published === true && !current.published;
  const willUnpublish = patch.published === false && current.published;
  const update: Record<string, unknown> = {
    ...patch,
    updatedAt: new Date(),
  };
  if (willPublish) update.publishedAt = new Date();
  if (willUnpublish) update.publishedAt = null;
  const rows = await db.update(articles).set(update).where(eq(articles.id, id)).returning();
  return rows[0] ?? null;
}

export async function deleteArticle(id: string): Promise<boolean> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db.delete(articles).where(eq(articles.id, id)).returning({ id: articles.id });
  return rows.length > 0;
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
      .select()
      .from(articles)
      .where(and(eq(articles.published, true), lt(articles.publishedAt, publishedAt)))
      .orderBy(desc(articles.publishedAt))
      .limit(1),
    db
      .select()
      .from(articles)
      .where(and(eq(articles.published, true), gt(articles.publishedAt, publishedAt)))
      .orderBy(asc(articles.publishedAt))
      .limit(1),
  ]);
  return { prev: prevRows[0] ?? null, next: nextRows[0] ?? null };
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
  return db
    .select()
    .from(articles)
    .where(and(
      eq(articles.published, true),
      eq(articles.sport, sport),
      ne(articles.id, currentId),
    ))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

// ---------- audience / intake ledgers ----------

export async function upsertNewsletterSubscriber(input: {
  email: string;
  source?: string;
  ip?: string | null;
  userAgent?: string | null;
}): Promise<NewsletterSubscriber> {
  if (!db) throw new Error('Database not available');
  await ensureBootstrapped();
  const rows = await db
    .insert(newsletterSubscribers)
    .values({
      email: input.email,
      source: input.source ?? 'site',
      lastIpAddress: input.ip ?? null,
      lastUserAgent: input.userAgent ?? null,
    })
    .onConflictDoUpdate({
      target: newsletterSubscribers.email,
      set: {
        status: 'subscribed',
        source: input.source ?? 'site',
        lastIpAddress: input.ip ?? null,
        lastUserAgent: input.userAgent ?? null,
        unsubscribedAt: null,
        updatedAt: new Date(),
        signupCount: sql`${newsletterSubscribers.signupCount} + 1`,
      },
    })
    .returning();
  return rows[0];
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
      ipAddress: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })
    .returning();
  return rows[0];
}

export async function getAudienceSnapshot(): Promise<{
  counts: {
    subscribers: number;
    contactNew: number;
    donationWaiting: number;
  };
  recentSubscribers: NewsletterSubscriber[];
  recentMessages: ContactMessage[];
  recentDonationIntents: DonationIntent[];
}> {
  if (!db) {
    return {
      counts: { subscribers: 0, contactNew: 0, donationWaiting: 0 },
      recentSubscribers: [],
      recentMessages: [],
      recentDonationIntents: [],
    };
  }
  await ensureBootstrapped();
  const [
    subscriberRows,
    contactRows,
    donationRows,
    recentSubscribers,
    recentMessages,
    recentDonationIntents,
  ] = await Promise.all([
    db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.status, 'subscribed')),
    db.select().from(contactMessages).where(eq(contactMessages.status, 'new')),
    db.select().from(donationIntents).where(eq(donationIntents.status, 'waiting_for_stripe')),
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
  return {
    counts: {
      subscribers: subscriberRows.length,
      contactNew: contactRows.length,
      donationWaiting: donationRows.length,
    },
    recentSubscribers,
    recentMessages,
    recentDonationIntents,
  };
}

export { dbAvailable };
