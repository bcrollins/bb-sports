'use client';
import Link from 'next/link';

/**
 * Site-wide error UI. Plain English for Brad — never a raw stack trace.
 * Digest is shown only as a short reference for Brandon, not as the headline.
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="bg-bone min-h-[60vh]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16 text-center">
        <p className="bb-eyebrow">Temporary glitch</p>
        <h1 className="mt-3 font-serif font-extrabold text-navy-900 text-4xl sm:text-6xl tracking-tight">
          That page hiccuped.
        </h1>
        <p className="mt-4 text-lg text-charcoal/85">
          This is not your fault. Try again, or jump back to the desk. If you were signing into the
          newsroom, use the newsroom sign-in link below.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button onClick={() => reset()} className="bb-button-primary">
            Try again
          </button>
          <Link href="/admin/login" className="bb-button-primary">
            Newsroom sign-in
          </Link>
          <Link href="/" className="bb-button-ghost">
            Back to home
          </Link>
        </div>
        {error?.digest ? (
          <p className="mt-6 text-xs text-charcoal/60">
            Support code for Brandon: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
