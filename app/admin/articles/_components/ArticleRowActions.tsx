'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ArticleRowActions({
  id,
  liveSlug,
  published,
  canDelete,
}: {
  id: string;
  liveSlug: string | null;
  published: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    if (published || !canDelete) return;
    if (!window.confirm('Delete this never-published draft? This cannot be undone.')) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
      const data: unknown = await response.json().catch(() => ({}));
      const payload =
        data !== null && typeof data === 'object' && !Array.isArray(data)
          ? (data as Record<string, unknown>)
          : null;
      if (!response.ok || payload?.ok === false) {
        throw new Error(
          typeof payload?.error === 'string' ? payload.error : 'The article could not be deleted.',
        );
      }
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The article could not be deleted.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="inline-flex flex-wrap items-center justify-end gap-2">
      <span className="sr-only">{published ? 'Live approved snapshot' : 'Draft only'}</span>
      {published && liveSlug ? (
        <Link
          href={`/articles/${liveSlug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center rounded px-2 text-xs text-navy/70 underline underline-offset-2 hover:text-broadcast-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50"
        >
          View live
        </Link>
      ) : null}
      <Link
        href={`/admin/articles/${id}/edit`}
        className="inline-flex min-h-11 items-center rounded border border-navy/20 px-3 text-xs font-semibold hover:bg-bone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50"
      >
        Edit draft
      </Link>
      {!published && canDelete ? (
        <button
          type="button"
          onClick={() => void remove()}
          disabled={deleting}
          className="inline-flex min-h-11 items-center rounded border border-broadcast-red/30 px-3 text-xs font-semibold text-broadcast-red hover:bg-broadcast-red/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-broadcast-red/50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Delete virgin draft'}
        </button>
      ) : null}
      {error ? (
        <span role="alert" className="basis-full text-xs text-broadcast-red">
          {error}
        </span>
      ) : null}
    </div>
  );
}
