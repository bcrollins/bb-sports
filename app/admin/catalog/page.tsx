import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import { canPublishArticle } from '@/lib/article-publication';
import { getCatalogReconcileSnapshot } from '@/lib/catalog-import';
import { CatalogImportControls } from './_components/CatalogImportControls';

export const dynamic = 'force-dynamic';

export default async function CatalogPage() {
  const user = await requireAdminPage('/admin/catalog');
  const snapshot = await getCatalogReconcileSnapshot();
  const canImport = canPublishArticle(user.role);

  return (
    <div>
      <header className="mb-8 border-b border-navy/15 pb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-navy/45">
          Editorial data plane
        </p>
        <h1 className="mt-1 font-display text-3xl italic text-navy">Catalog reconcile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-charcoal/80">
          Compare filesystem Markdown under <code className="rounded bg-navy/5 px-1">content/articles</code>{' '}
          to the Postgres catalog. Import creates <strong>drafts only</strong> — never publishes.
          Brad still must approve with the exact phrase + revision hash.
        </p>
      </header>

      <dl className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Filesystem files" value={snapshot.filesystemCount} />
        <Stat label="DB rows (all)" value={snapshot.databaseAllCount} />
        <Stat label="DB published" value={snapshot.databasePublishedCount} />
      </dl>

      <section className="mb-8 rounded border border-navy/10 bg-white p-4">
        <h2 className="font-serif text-xl font-bold text-navy">Missing from database</h2>
        <p className="mt-1 text-sm text-navy/60">
          {snapshot.missingFromDb.length === 0
            ? 'All filesystem articles already have a DB row.'
            : `${snapshot.missingFromDb.length} file(s) can be imported as drafts.`}
        </p>
        {snapshot.missingFromDb.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm">
            {snapshot.missingFromDb.map((entry) => (
              <li key={entry.slug} className="flex flex-wrap gap-2 border-b border-navy/5 py-2">
                <code className="font-mono text-xs text-navy">{entry.slug}</code>
                <span className="text-charcoal/70">{entry.title}</span>
              </li>
            ))}
          </ul>
        ) : null}
        {canImport ? (
          <CatalogImportControls
            missingSlugs={snapshot.missingFromDb.map((e) => e.slug)}
          />
        ) : (
          <p className="mt-4 text-sm text-broadcast-red">
            Super-admin role required to import drafts.
          </p>
        )}
      </section>

      <section className="rounded border border-navy/10 bg-white p-4">
        <h2 className="font-serif text-xl font-bold text-navy">On disk but not published</h2>
        <p className="mt-1 text-sm text-navy/60">
          Includes drafts already in DB. Publishing still requires Brad&rsquo;s approval gate.
        </p>
        <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto text-sm">
          {snapshot.notPublished.map((entry) => (
            <li key={entry.slug}>
              <code className="font-mono text-xs">{entry.slug}</code>
              {' — '}
              <Link className="bb-link" href={`/admin/articles`}>
                open articles
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-navy/10 bg-white p-4">
      <dt className="text-[10px] font-black uppercase tracking-[0.18em] text-navy/45">{label}</dt>
      <dd className="mt-1 font-mono text-2xl font-bold text-navy">{value}</dd>
    </div>
  );
}
