import Link from 'next/link';
import { requireAdminPage } from '@/lib/admin-auth';
import FactCheckChecklist from '@/components/FactCheckChecklist';
import { db, dbAvailable } from '@/lib/db/client';
import { editorialFindings } from '@/lib/db/schema';
import { ensureBootstrapped } from '@/lib/db/bootstrap';
import { SEED_EDITORIAL_FINDINGS } from '@/lib/editorial-findings';
import { desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function EditorialFindingsPage() {
  await requireAdminPage('/admin/findings');

  let rows: Array<{
    findingKey: string;
    articleSlug: string;
    quotedClaim: string;
    findingType: string;
    severity: string;
    evidenceNote: string;
    proposedCorrection: string;
    state: string;
  }> = [];

  if (dbAvailable && db) {
    await ensureBootstrapped();
    const dbRows = await db
      .select()
      .from(editorialFindings)
      .orderBy(desc(editorialFindings.createdAt))
      .limit(100);
    rows = dbRows.map((r) => ({
      findingKey: r.findingKey,
      articleSlug: r.articleSlug,
      quotedClaim: r.quotedClaim,
      findingType: r.findingType,
      severity: r.severity,
      evidenceNote: r.evidenceNote,
      proposedCorrection: r.proposedCorrection,
      state: r.state,
    }));
  }

  if (rows.length === 0) {
    rows = SEED_EDITORIAL_FINDINGS.map((f) => ({
      ...f,
      state: 'open',
    }));
  }

  return (
    <div>
      <header className="mb-8 border-b border-navy/15 pb-3">
        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-navy/45">
          Editorial integrity
        </p>
        <h1 className="mt-1 font-display text-3xl italic text-navy">Findings queue</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-charcoal/80">
          Disputed or stale claims waiting for Brad. Findings never rewrite live prose
          without an approved correction. Prefix publish rationales with{' '}
          <code className="rounded bg-navy/5 px-1">opinion-only</code> for pure takes without
          external links.
        </p>
      </header>

      <div className="mb-8 max-w-2xl">
        <FactCheckChecklist storageKey="bb-fact-check-findings" />
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-navy/60">No open findings.</p>
      ) : (
        <ul className="grid gap-4">
          {rows.map((finding) => (
            <li
              key={finding.findingKey}
              className="rounded border border-navy/10 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em]">
                <span className="rounded bg-broadcast-red/10 px-2 py-1 text-broadcast-red">
                  {finding.severity}
                </span>
                <span className="rounded bg-navy/5 px-2 py-1 text-navy/70">{finding.findingType}</span>
                <span className="rounded bg-navy/5 px-2 py-1 text-navy/70">{finding.state}</span>
              </div>
              <h2 className="mt-3 font-serif text-xl font-bold text-navy">
                “{finding.quotedClaim}”
              </h2>
              <p className="mt-1 text-sm text-navy/70">
                Article:{' '}
                <Link
                  className="font-semibold underline decoration-breaking underline-offset-4"
                  href={`/articles/${finding.articleSlug}`}
                >
                  {finding.articleSlug}
                </Link>
              </p>
              <p className="mt-3 text-sm leading-relaxed text-charcoal/85">{finding.evidenceNote}</p>
              <p className="mt-2 text-sm leading-relaxed text-charcoal/70">
                <span className="font-bold text-navy">Proposed: </span>
                {finding.proposedCorrection}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
