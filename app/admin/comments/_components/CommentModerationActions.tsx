'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CommentStatus } from '@/lib/comment-validation';

const ACTIONS: Array<{ status: CommentStatus; label: string }> = [
  { status: 'approved', label: 'Approve' },
  { status: 'flagged', label: 'Flag' },
  { status: 'hidden', label: 'Hide' },
  { status: 'spam', label: 'Spam' },
];

export function CommentModerationActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<CommentStatus | null>(null);
  const [error, setError] = useState('');

  async function update(status: CommentStatus) {
    setPending(status);
    setError('');
    try {
      const res = await fetch(`/api/admin/comments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Comment update failed.');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comment update failed.');
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <button
            key={action.status}
            type="button"
            onClick={() => update(action.status)}
            disabled={pending !== null}
            className="inline-flex min-h-[36px] items-center rounded border border-navy/15 bg-white px-3 text-xs font-bold uppercase tracking-[0.14em] text-navy/72 hover:border-broadcast-red hover:text-broadcast-red disabled:opacity-50"
          >
            {pending === action.status ? 'Saving...' : action.label}
          </button>
        ))}
      </div>
      {error ? <p className="mt-2 text-sm text-broadcast-red">{error}</p> : null}
    </div>
  );
}
