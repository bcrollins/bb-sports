# Article catalog reconciliation

**Rule:** Never auto-publish filesystem Markdown into the live catalog. Brad must approve.

## Helpers

- `lib/article-catalog-reconcile.ts`
  - `listFilesystemArticleMeta()` — content/articles/*.md
  - `buildCatalogReconcileManifest({ filesystem, databasePublishedSlugs })` — review-only

## Operator workflow

1. Export published DB slugs (admin or SQL):
   `SELECT slug FROM articles WHERE published = true ORDER BY slug;`
2. Build manifest in a one-off Node/tsx session using the helpers.
3. For each `filesystemOnly` entry: import as **draft** if missing, never flip `published` without Brad’s phrase + approval transaction.
4. Re-run public smoke after any publish: home, archive, search, RSS, sitemap slug sets must match.

## Product law

Public reads use Postgres published snapshots only when `DATABASE_URL` is set (`lib/articles.ts`). Filesystem is seed/bootstrap material, not a second public catalog.
