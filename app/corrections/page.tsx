import Link from 'next/link';

export const metadata = {
  title: 'Corrections',
  description: 'Public log of BB Sports corrections, with date, article, and what was changed.'
};

const CORRECTIONS: Array<{ date: string; article: string; href?: string; was: string; nowIs: string }> = [
  // The corrections log starts empty. Real entries are appended chronologically (most-recent first).
];

export default function CorrectionsPage() {
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
            Every correction BB Sports has made, with the date, the article, what was wrong, and what it now says. Newest first.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        {CORRECTIONS.length === 0 ? (
          <div className="bg-white border border-navy/15 rounded p-6">
            <h2 className="font-serif text-2xl font-bold text-navy-900">Empty (for now).</h2>
            <p className="mt-2 text-charcoal/85">
              When BB Sports issues its first correction, it goes here — visible, dated, and linked back to the piece.
              Spot something wrong?{' '}
              <Link href="/contact" className="bb-link">
                Tell us
              </Link>{' '}
              — we’d rather know than not know.
            </p>
          </div>
        ) : (
          <ol className="space-y-6">
            {CORRECTIONS.map((c, i) => (
              <li key={i} className="bg-white border border-navy/15 rounded p-5">
                <div className="text-xs uppercase tracking-[0.16em] text-charcoal/60">
                  <time dateTime={c.date}>{c.date}</time>
                </div>
                <h3 className="mt-2 font-serif text-xl font-bold text-navy-900">{c.article}</h3>
                <p className="mt-2 text-sm text-charcoal/85">
                  <strong>Was:</strong> {c.was}
                </p>
                <p className="mt-1 text-sm text-charcoal/85">
                  <strong>Now reads:</strong> {c.nowIs}
                </p>
                {c.href && (
                  <Link href={c.href} className="bb-link mt-3 inline-block text-sm">
                    Read the corrected piece →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
