export default function ArchiveLoading() {
  return (
    <div className="min-h-[40vh] bg-navy-deep px-4 py-16 text-bone sm:px-6" aria-busy="true">
      <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-breaking">Loading archive…</p>
      <div className="mt-6 h-12 w-2/3 max-w-lg animate-pulse rounded bg-bone/10" />
      <div className="mt-4 h-4 w-1/2 max-w-md animate-pulse rounded bg-bone/10" />
    </div>
  );
}
