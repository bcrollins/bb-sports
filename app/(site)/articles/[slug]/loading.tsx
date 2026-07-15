export default function ArticleLoading() {
  return (
    <div className="min-h-[50vh] bg-bone" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-readable px-4 py-12 sm:px-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-navy/45">Loading take…</p>
        <div className="mt-6 h-10 w-3/4 max-w-xl animate-pulse rounded bg-navy/10" />
        <div className="mt-4 h-4 w-1/2 animate-pulse rounded bg-navy/10" />
        <div className="mt-10 space-y-3">
          <div className="h-4 w-full animate-pulse rounded bg-navy/10" />
          <div className="h-4 w-full animate-pulse rounded bg-navy/10" />
          <div className="h-4 w-5/6 animate-pulse rounded bg-navy/10" />
          <div className="h-4 w-4/5 animate-pulse rounded bg-navy/10" />
        </div>
      </div>
    </div>
  );
}
