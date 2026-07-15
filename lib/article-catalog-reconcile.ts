/**
 * Article catalog reconciliation helpers.
 *
 * Compares filesystem Markdown under content/articles to a list of published
 * DB slugs. Never publishes, never deletes. Output is a review manifest for Brad.
 */
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

export type CatalogReconcileEntry = {
  slug: string;
  title: string;
  source: 'filesystem' | 'database' | 'both';
  publishedInDb: boolean;
  filesystemPath: string | null;
};

export type CatalogReconcileManifest = {
  generatedAt: string;
  filesystemCount: number;
  databasePublishedCount: number;
  both: string[];
  filesystemOnly: CatalogReconcileEntry[];
  databaseOnly: string[];
  recommendation: string;
};

const DEFAULT_DIR = path.join(process.cwd(), 'content', 'articles');

export function listFilesystemArticleMeta(
  articlesDir: string = DEFAULT_DIR,
): Array<{ slug: string; title: string; filePath: string }> {
  if (!fs.existsSync(articlesDir)) return [];
  return fs
    .readdirSync(articlesDir)
    .filter((f) => f.endsWith('.md'))
    .map((file) => {
      const filePath = path.join(articlesDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const { data } = matter(raw);
      const slug = String(data.slug ?? file.replace(/\.md$/, ''));
      const title = String(data.title ?? slug);
      return { slug, title, filePath };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug));
}

export function buildCatalogReconcileManifest(input: {
  filesystem: Array<{ slug: string; title: string; filePath: string }>;
  databasePublishedSlugs: string[];
  now?: Date;
}): CatalogReconcileManifest {
  const dbSet = new Set(input.databasePublishedSlugs);
  const fsMap = new Map(input.filesystem.map((f) => [f.slug, f]));
  const both: string[] = [];
  const filesystemOnly: CatalogReconcileEntry[] = [];

  for (const fsEntry of input.filesystem) {
    if (dbSet.has(fsEntry.slug)) {
      both.push(fsEntry.slug);
    } else {
      filesystemOnly.push({
        slug: fsEntry.slug,
        title: fsEntry.title,
        source: 'filesystem',
        publishedInDb: false,
        filesystemPath: fsEntry.filePath,
      });
    }
  }

  const databaseOnly = input.databasePublishedSlugs
    .filter((slug) => !fsMap.has(slug))
    .sort();

  return {
    generatedAt: (input.now ?? new Date()).toISOString(),
    filesystemCount: input.filesystem.length,
    databasePublishedCount: input.databasePublishedSlugs.length,
    both: both.sort(),
    filesystemOnly,
    databaseOnly,
    recommendation:
      filesystemOnly.length === 0
        ? 'Catalogs align for filesystem candidates. No import action required.'
        : `${filesystemOnly.length} filesystem article(s) are not published in the DB catalog. Import as drafts only; Brad must approve publication. Never auto-publish.`,
  };
}
