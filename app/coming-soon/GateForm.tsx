/**
 * Client form for the site-wide white access wall. Posts to /api/gate.
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
    <form onSubmit={onSubmit} className="w-full max-w-[280px] space-y-3" aria-label="BB Sports access wall">
      <input
        type="password"
        autoComplete="off"
        aria-label="Access password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        className="h-11 w-full rounded-none border border-black/15 bg-white px-3 text-[15px] text-black outline-none focus:border-black"
      />
      <button
        type="submit"
        disabled={submitting}
        className="h-11 w-full bg-black px-4 text-[12px] font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-50"
      >
        {submitting ? 'Checking' : 'Enter'}
      </button>
      {error ? (
        <div className="text-center text-[12px] text-black/65">
          {error}
        </div>
      ) : null}
    </form>
  );
}
