/**
 * /admin/articles — full article roster.
 */
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { canPublishArticle } from '@/lib/article-publication';
import { getAllArticlesForAdmin } from '@/lib/queries';
import { ArticleRowActions } from './_components/ArticleRowActions';

export const dynamic = 'force-dynamic';

export default async function ArticlesIndex() {
  const user = await requireAdminPage('/admin/articles');
  const all = await getAllArticlesForAdmin();
  const canDelete = canPublishArticle(user.role);
  return (
    <div>
      <header className="border-b border-navy/15 pb-3 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">── Articles</p>
          <h1 className="font-display italic text-4xl mt-1">All articles</h1>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex min-h-11 items-center rounded bg-broadcast-red px-4 py-2.5 text-sm font-bold uppercase tracking-[0.18em] text-bone hover:bg-broadcast-red/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50"
        >
          New article
        </Link>
      </header>

      {all.length === 0 ? (
        <p className="text-sm text-navy/70">No articles yet.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-navy/10 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-bone-50 border-b border-navy/10 text-left">
              <tr className="font-mono uppercase text-[10px] tracking-[0.18em] text-navy/60">
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5 hidden md:table-cell">Sport</th>
                <th className="px-4 py-2.5 hidden lg:table-cell">Updated</th>
                <th className="px-4 py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-navy/10">
              {all.map(({ article: a, liveArticle: live, canDeleteVirginDraft }) => {
                const liveIntegrityPresent = Boolean(live);
                const draftDiffers = Boolean(
                  live &&
                    (a.slug !== live.slug ||
                      a.title !== live.title ||
                      a.dek !== live.dek ||
                      a.body !== live.body ||
                      a.sport !== live.sport ||
                      a.hero !== live.hero ||
                      a.heroAlt !== live.heroAlt ||
                      a.heroCredit !== live.heroCredit ||
                      a.authorName !== live.authorName ||
                      a.aiAssisted !== live.aiAssisted ||
                      a.bradsTake !== live.bradsTake),
                );
                return (
                  <tr key={a.id} className="hover:bg-bone-50">
                    <td className="px-4 py-2.5">
                      <span className={`font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded ${
                        a.published ? 'bg-broadcast-red/10 text-broadcast-red' : 'bg-navy/10 text-navy/70'
                      }`}>
                        {a.published
                          ? liveIntegrityPresent
                            ? 'LIVE SNAPSHOT'
                            : 'INTEGRITY HOLD'
                          : 'DRAFT'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link href={`/admin/articles/${a.id}/edit`} className="font-serif font-bold text-navy hover:text-broadcast-red">
                        {a.published
                          ? live?.title ?? 'Live article hidden — integrity check failed'
                          : a.title}
                      </Link>
                      <div className="text-xs text-navy/50 truncate max-w-md">
                        {a.published
                          ? live?.dek ?? 'Public delivery is blocked until the approved snapshot is repaired.'
                          : a.dek}
                      </div>
                      {draftDiffers ? (
                        <div className="mt-1 max-w-md truncate text-xs font-semibold text-amber-700">
                          Unpublished draft changes: {a.title}
                        </div>
                      ) : a.published && !live ? (
                        <div className="mt-1 max-w-md truncate text-xs font-semibold text-amber-700">
                          Working draft (not live): {a.title}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 hidden md:table-cell text-navy/70">
                      {a.published ? live?.sport ?? 'Integrity hold' : a.sport}
                    </td>
                    <td className="px-4 py-2.5 hidden lg:table-cell text-navy/50 text-xs">
                      {new Date(a.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <ArticleRowActions
                        id={a.id}
                        liveSlug={live?.slug ?? null}
                        published={a.published}
                        canDelete={canDelete && canDeleteVirginDraft}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
