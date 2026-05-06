'use client';
import Link from 'next/link';

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
        <p className="bb-eyebrow">Server error</p>
        <h1 className="mt-3 font-serif font-extrabold text-navy-900 text-4xl sm:text-6xl tracking-tight">
          Something fell over.
        </h1>
        <p className="mt-4 text-lg text-charcoal/85">
          Brandon (the engineer) gets paged when this happens. While he debugs:
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <button onClick={() => reset()} className="bb-button-primary">
            Try again
          </button>
          <Link href="/" className="bb-button-ghost">Back to home</Link>
        </div>
        {error?.digest && (
          <p className="mt-6 text-xs text-charcoal/60">Reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
