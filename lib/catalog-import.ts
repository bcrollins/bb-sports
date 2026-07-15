/**
 * Import filesystem Markdown articles as **drafts only**.
 * Never sets published=true. Brad must approve via the normal publish gate.
 */
import matter from 'gray-matter';
import { eq } from 'drizzle-orm';
import { db, dbAvailable } from './db/client';
import { ensureBootstrapped } from './db/bootstrap';
import { articles } from './db/schema';
import {
  buildCatalogReconcileManifest,
  listFilesystemArticleMeta,
} from './article-catalog-reconcile';
import { readFileSync } from 'node:fs';

export type CatalogImportResult = {
  dryRun: boolean;
  considered: string[];
  imported: string[];
  skippedExisting: string[];
  errors: Array<{ slug: string; error: string }>;
};

export async function listPublishedAndAllDbSlugs(): Promise<{
  published: string[];
  all: string[];
}> {
  if (!dbAvailable || !db) return { published: [], all: [] };
  await ensureBootstrapped();
  const rows = await db
    .select({ slug: articles.slug, published: articles.published })
    .from(articles);
  return {
    published: rows.filter((r) => r.published).map((r) => r.slug).sort(),
    all: rows.map((r) => r.slug).sort(),
  };
}

export async function getCatalogReconcileSnapshot() {
  const fsMeta = listFilesystemArticleMeta();
  const { published, all } = await listPublishedAndAllDbSlugs();
  const againstPublished = buildCatalogReconcileManifest({
    filesystem: fsMeta,
    databasePublishedSlugs: published,
  });
  const againstAll = buildCatalogReconcileManifest({
    filesystem: fsMeta,
    databasePublishedSlugs: all,
  });
  return {
    filesystemCount: fsMeta.length,
    databaseAllCount: all.length,
    databasePublishedCount: published.length,
    /** Present on disk but not published in DB (may still exist as drafts). */
    notPublished: againstPublished.filesystemOnly,
    /** Present on disk and missing from DB entirely (import candidates). */
    missingFromDb: againstAll.filesystemOnly,
    recommendation: againstAll.recommendation,
  };
}

/**
 * Import selected filesystem slugs as unpublished drafts.
 * Idempotent: existing slugs are skipped (never overwritten).
 */
export async function importFilesystemArticlesAsDrafts(input: {
  slugs?: string[];
  dryRun?: boolean;
  authorName?: string;
}): Promise<CatalogImportResult> {
  if (!dbAvailable || !db) {
    throw new Error('DATABASE_URL is required for catalog import.');
  }
  await ensureBootstrapped();

  const fsMeta = listFilesystemArticleMeta();
  const { all } = await listPublishedAndAllDbSlugs();
  const existing = new Set(all);
  const wanted = new Set(
    (input.slugs && input.slugs.length > 0
      ? input.slugs
      : fsMeta.filter((f) => !existing.has(f.slug)).map((f) => f.slug)
    ).map((s) => s.trim()),
  );

  const result: CatalogImportResult = {
    dryRun: Boolean(input.dryRun),
    considered: [...wanted].sort(),
    imported: [],
    skippedExisting: [],
    errors: [],
  };

  for (const meta of fsMeta) {
    if (!wanted.has(meta.slug)) continue;
    if (existing.has(meta.slug)) {
      result.skippedExisting.push(meta.slug);
      continue;
    }
    try {
      const raw = readFileSync(meta.filePath, 'utf8');
      const { data, content } = matter(raw);
      const values = {
        slug: meta.slug,
        title: String(data.title ?? meta.title ?? meta.slug),
        dek: String(data.dek ?? data.description ?? ''),
        body: content.trim(),
        sport: String(data.sport ?? 'Op-Ed'),
        hero: String(data.hero ?? ''),
        heroAlt: String(data.heroAlt ?? ''),
        heroCredit: String(data.heroCredit ?? ''),
        authorName: String(data.author ?? input.authorName ?? 'Brad Benson'),
        aiAssisted: Boolean(data.aiAssisted),
        bradsTake: String(data.bradsTake ?? ''),
        published: false as const,
        publishedAt: null,
        createdUnderApprovalGate: false,
      };
      if (!input.dryRun) {
        await db.insert(articles).values(values).onConflictDoNothing({ target: articles.slug });
        // Confirm presence
        const check = await db
          .select({ slug: articles.slug })
          .from(articles)
          .where(eq(articles.slug, meta.slug))
          .limit(1);
        if (!check[0]) {
          result.errors.push({ slug: meta.slug, error: 'Insert did not land.' });
          continue;
        }
      }
      result.imported.push(meta.slug);
      existing.add(meta.slug);
    } catch (err) {
      result.errors.push({
        slug: meta.slug,
        error: err instanceof Error ? err.message : 'Import failed.',
      });
    }
  }

  return result;
}

