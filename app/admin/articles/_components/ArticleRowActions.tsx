'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function ArticleRowActions({ id, slug, published }: { id: string; slug: string; published: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<'toggle' | 'delete' | null>(null);

  async function toggle() {
    setPending('toggle');
    try {
      await fetch(`/api/admin/articles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !published }),
      });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    if (!confirm('Delete this article? This cannot be undone.')) return;
    setPending('delete');
    try {
      await fetch(`/api/admin/articles/${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      {published ? (
        <Link
          href={`/articles/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="text-xs underline text-navy/70 hover:text-broadcast-red"
        >
          View
        </Link>
      ) : null}
      <Link
        href={`/admin/articles/${id}/edit`}
        className="text-xs px-2.5 py-1 border border-navy/20 rounded hover:bg-bone-50"
      >
        Edit
      </Link>
      <button
        type="button"
        onClick={toggle}
        disabled={pending !== null}
        className="text-xs px-2.5 py-1 border border-navy/20 rounded hover:bg-bone-50 disabled:opacity-50"
      >
        {pending === 'toggle' ? '…' : published ? 'Unpublish' : 'Publish'}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={pending !== null}
        className="text-xs px-2.5 py-1 border border-broadcast-red/30 text-broadcast-red rounded hover:bg-broadcast-red/5 disabled:opacity-50"
      >
        {pending === 'delete' ? '…' : 'Delete'}
      </button>
    </div>
  );
}
