'use client';

import { useCallback, useEffect, useState } from 'react';

type HistoryRow = {
  id: string;
  revisionNumber: number;
  contentHash: string;
  createdAt: string;
  changedFields: string[];
  summary: string;
  snapshot: {
    title: string;
    slug: string;
    dek: string;
    body: string;
    sport: string;
    hero: string;
    heroAlt: string;
    heroCredit: string;
    authorName: string;
    aiAssisted: boolean;
    bradsTake: string;
  };
};

/**
 * Editor-visible immutable revision history.
 * Restore copies snapshot fields into the draft form only — never deletes history.
 */
export default function RevisionHistoryPanel({
  articleId,
  onRestoreSnapshot,
}: {
  articleId: string;
  onRestoreSnapshot: (snapshot: HistoryRow['snapshot']) => void;
}) {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/articles/${articleId}/revisions`, {
        cache: 'no-store',
      });
      const data = (await res.json().catch(() => ({}))) as {
        revisions?: HistoryRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Could not load revisions.');
      setRows(Array.isArray(data.revisions) ? data.revisions : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load revisions.');
    } finally {
      setLoading(false);
    }
  }, [articleId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section
      className="rounded border border-navy/15 bg-white p-4 shadow-sm"
      aria-labelledby="revision-history-heading"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] font-black uppercase tracking-[0.2em] text-navy/45">
            Append-only
          </p>
          <h2 id="revision-history-heading" className="mt-1 font-serif text-xl font-bold text-navy-900">
            Revision history
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex min-h-[44px] items-center rounded border border-navy/20 px-3 text-xs font-bold uppercase tracking-[0.14em] text-navy hover:bg-bone-50"
        >
          Refresh
        </button>
      </div>
      <p className="mt-2 text-sm text-charcoal/70">
        Every prepared revision is immutable. Restore loads fields into the working draft — you
        still save and re-prepare before publish.
      </p>
      {loading ? (
        <p className="mt-3 text-sm text-navy/50" role="status">
          Loading revisions…
        </p>
      ) : error ? (
        <p className="mt-3 text-sm text-breaking" role="alert">
          {error}
        </p>
      ) : rows.length === 0 ? (
        <p className="mt-3 text-sm text-navy/55">No prepared revisions yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-navy/10">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-navy/45">
                  Rev {row.revisionNumber} · {new Date(row.createdAt).toLocaleString()}
                </p>
                <p className="mt-1 font-serif text-base font-bold text-navy-900">
                  {row.snapshot.title || 'Untitled'}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-navy/50">{row.contentHash}</p>
                <p className="mt-1 text-xs text-charcoal/70">Δ {row.summary}</p>
              </div>
              <button
                type="button"
                className="bb-button-ghost !min-h-[44px] shrink-0"
                onClick={() => {
                  if (
                    window.confirm(
                      'Load this revision into the working draft? History is kept; you must save and re-prepare to publish.',
                    )
                  ) {
                    onRestoreSnapshot(row.snapshot);
                  }
                }}
              >
                Restore to draft
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
