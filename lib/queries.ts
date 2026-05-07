/**
 * BB Sports — high-level data access. Used by both public pages and admin routes.
 *
 * All queries trigger `ensureBootstrapped()` first so the DB is always ready before
 * the first read. If DATABASE_URL is missing (local dev with no Postgres), every
 * accessor returns an empty result so the public site degrades gracefully instead
 * of crashing.
 */
import { and, asc, desc, eq } from 'drizzle-orm';
import { db, dbAvailable } from './db/client';
import { articles, siteConfig, type Article } from './db/schema';
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
  authorId?: string | null;
  authorName?: string;
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
      authorId: input.authorId ?? undefined,
      authorName: input.authorName ?? 'Brad Benson',
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
    authorName: string;
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
  const [prevRows, nextRows] = await Promise.all([
    db
      .select()
      .from(articles)
      .where(and(eq(articles.published, true)))
      .orderBy(desc(articles.publishedAt))
      .limit(50),
    db
      .select()
      .from(articles)
      .where(and(eq(articles.published, true)))
      .orderBy(asc(articles.publishedAt))
      .limit(50),
  ]);
  const prev = prevRows.find((a) => a.publishedAt && a.publishedAt < publishedAt) ?? null;
  const next = nextRows.find((a) => a.publishedAt && a.publishedAt > publishedAt) ?? null;
  return { prev, next };
}

export { dbAvailable };
