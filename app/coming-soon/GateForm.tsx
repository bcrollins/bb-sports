/**
 * Client form for the /coming-soon site gate. Posts to /api/gate.
 */
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GateForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/';
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Wrong password');
      } else {
        router.push(next.startsWith('/') ? next : '/');
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 flex flex-col sm:flex-row gap-2">
      <input
        type="password"
        autoComplete="off"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="flex-1 border border-navy/20 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
      />
      <button
        type="submit"
        disabled={submitting}
        className="inline-flex items-center justify-center bg-broadcast-red text-bone uppercase tracking-[0.18em] text-sm font-bold px-5 py-3 rounded hover:bg-broadcast-red/90 disabled:opacity-60"
      >
        {submitting ? 'Checking…' : 'Step inside'}
      </button>
      {error ? (
        <div className="sm:basis-full text-sm text-broadcast-red bg-broadcast-red/5 border border-broadcast-red/30 rounded px-3 py-2">
          {error}
        </div>
      ) : null}
    </form>
  );
}
