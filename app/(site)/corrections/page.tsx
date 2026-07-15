import Link from 'next/link';
import { sql } from 'drizzle-orm';
import { db, dbAvailable } from '@/lib/db/client';
import { ensureBootstrapped } from '@/lib/db/bootstrap';

export const metadata = {
  title: 'Corrections',
  description:
    'Public log of BB Sports corrections, with date, article, and what was changed.',
};

export const dynamic = 'force-dynamic';

type CorrectionRow = {
  date: string;
  article: string;
  href?: string;
  was: string;
  nowIs: string;
  source: 'ledger' | 'seed';
};

async function loadCorrections(): Promise<CorrectionRow[]> {
  if (!dbAvailable || !db) return [];
  try {
    await ensureBootstrapped();
    const rows = await db.execute(sql`
      SELECT finding_key, article_slug, quoted_claim, proposed_correction, state, updated_at
      FROM editorial_findings
      WHERE state IN ('corrected', 'approved_for_edit')
      ORDER BY updated_at DESC
      LIMIT 50
    `);
    return (rows as unknown as Array<{
      finding_key: string;
      article_slug: string;
      quoted_claim: string;
      proposed_correction: string;
      state: string;
      updated_at: Date | string;
    }>).map((r) => ({
      date: new Date(r.updated_at).toISOString().slice(0, 10),
      article: r.article_slug,
      href: `/articles/${r.article_slug}`,
      was: r.quoted_claim,
      nowIs:
        r.state === 'corrected'
          ? r.proposed_correction
          : `Queued for Brad-approved edit: ${r.proposed_correction}`,
      source: 'ledger' as const,
    }));
  } catch {
    return [];
  }
}

export default async function CorrectionsPage() {
  const corrections = await loadCorrections();

  return (
    <div className="bg-bone">
      <header className="bg-navy-deep text-bone relative overflow-hidden">
        <div className="h-1 bg-breaking" aria-hidden="true" />
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
          <p className="bb-eyebrow !text-breaking !tracking-[0.32em]">Public log</p>
          <h1
            className="mt-3 font-display uppercase italic text-bone leading-[0.92] tracking-[-0.025em]"
            style={{ fontSize: 'clamp(2.25rem, 7vw, 5rem)' }}
          >
            Corrections.
          </h1>
          <p className="mt-3 text-bone/85">
            Every correction BB Sports has made, with the date, the article, what was wrong, and
            what it now says. Newest first. Open findings still awaiting Brad live in the{' '}
            <Link href="/admin/findings" className="underline decoration-breaking underline-offset-4">
              newsroom findings queue
            </Link>
            .
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {corrections.length === 0 ? (
          <div className="bg-white border border-navy/15 rounded p-6">
            <h2 className="font-serif text-2xl font-bold text-navy-900">Empty (for now).</h2>
            <p className="mt-2 text-charcoal/85">
              When BB Sports issues a correction, it goes here — visible, dated, and linked back
              to the piece. Spot something wrong?{' '}
              <Link href="/contact" className="bb-link">
                Tell us
              </Link>{' '}
              — we&rsquo;d rather know than not know.
            </p>
          </div>
        ) : (
          <ol className="space-y-6">
            {corrections.map((c) => (
              <li key={`${c.article}-${c.date}-${c.was}`} className="bg-white border border-navy/15 rounded p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-charcoal/60">
                  <time dateTime={c.date}>{c.date}</time>
                </div>
                <h3 className="mt-2 font-serif text-xl font-bold text-navy-900">{c.article}</h3>
                <p className="mt-2 text-sm text-charcoal/85">
                  <strong>Was:</strong> {c.was}
                </p>
                <p className="mt-1 text-sm text-charcoal/85">
                  <strong>Now / status:</strong> {c.nowIs}
                </p>
                {c.href ? (
                  <Link href={c.href} className="bb-link mt-3 inline-block text-sm">
                    Read the piece →
                  </Link>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
