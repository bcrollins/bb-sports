'use client';

import Link from 'next/link';

/**
 * Newsroom-only error UI. Brad should never see a raw developer stack page
 * while trying to edit or publish.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] bg-bone px-4 py-16 text-navy">
      <div className="mx-auto max-w-lg text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-broadcast-red">
          Newsroom glitch
        </p>
        <h1 className="mt-3 font-display text-4xl italic text-navy sm:text-5xl">
          The desk hit a snag.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-navy/75">
          Your work is safe in the database. This screen is temporary — not a 404, not a lost
          article. Try again, or sign back in and open the page from Command.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex min-h-[44px] items-center justify-center rounded bg-broadcast-red px-4 text-xs font-bold uppercase tracking-[0.18em] text-bone"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy/20 px-4 text-xs font-bold uppercase tracking-[0.18em] text-navy"
          >
            Command center
          </Link>
          <Link
            href="/admin/login"
            className="inline-flex min-h-[44px] items-center justify-center rounded border border-navy/20 px-4 text-xs font-bold uppercase tracking-[0.18em] text-navy"
          >
            Sign in again
          </Link>
        </div>
        {error?.digest ? (
          <p className="mt-8 text-xs text-navy/45">Support code for Brandon: {error.digest}</p>
        ) : null}
      </div>
    </div>
  );
}
