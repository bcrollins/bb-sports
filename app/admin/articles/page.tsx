/**
 * /admin/articles — full article roster.
 */
import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { getAllArticles } from '@/lib/queries';
import { ArticleRowActions } from './_components/ArticleRowActions';

export const dynamic = 'force-dynamic';

export default async function ArticlesIndex() {
  await requireAdminPage('/admin/articles');
  const all = await getAllArticles();
  return (
    <div>
      <header className="border-b border-navy/15 pb-3 mb-6 flex items-center gap-4">
        <div className="flex-1">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-broadcast-red">── Articles</p>
          <h1 className="font-display italic text-4xl mt-1">All articles</h1>
        </div>
        <Link
          href="/admin/articles/new"
          className="inline-flex items-center bg-broadcast-red text-bone uppercase tracking-[0.18em] text-sm font-bold px-4 py-2.5 rounded hover:bg-broadcast-red/90"
        >
          New article
        </Link>
      </header>

      {all.length === 0 ? (
        <p className="text-sm text-navy/70">No articles yet.</p>
      ) : (
        <div className="bg-white border border-navy/10 rounded overflow-hidden">
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
              {all.map((a) => (
                <tr key={a.id} className="hover:bg-bone-50">
                  <td className="px-4 py-2.5">
                    <span className={`font-mono text-[10px] uppercase tracking-[0.2em] px-2 py-1 rounded ${
                      a.published ? 'bg-broadcast-red/10 text-broadcast-red' : 'bg-navy/10 text-navy/70'
                    }`}>
                      {a.published ? 'LIVE' : 'DRAFT'}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/articles/${a.id}/edit`} className="font-serif font-bold text-navy hover:text-broadcast-red">
                      {a.title}
                    </Link>
                    <div className="text-xs text-navy/50 truncate max-w-md">{a.dek}</div>
                  </td>
                  <td className="px-4 py-2.5 hidden md:table-cell text-navy/70">{a.sport}</td>
                  <td className="px-4 py-2.5 hidden lg:table-cell text-navy/50 text-xs">
                    {new Date(a.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <ArticleRowActions id={a.id} slug={a.slug} published={a.published} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
