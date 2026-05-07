/**
 * /admin/login — admin sign-in page.
 *
 * Brad-only: posts to /api/admin/login and redirects to ?next= or /admin on success.
 * Broadcast-grade visual treatment, but functionally minimal — this is a control room
 * door, not a marketing page.
 */
'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') ?? '/admin';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Sign in failed');
      } else {
        router.push(next);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-bone text-navy flex flex-col">
      <div className="border-b-4 border-broadcast-red bg-navy text-bone px-6 py-3 flex items-center gap-3">
        <Link href="/" className="font-display italic text-2xl tracking-wider hover:opacity-80">
          BB SPORTS
        </Link>
        <span className="text-xs uppercase tracking-[0.3em] text-bone/70 ml-auto">Newsroom</span>
      </div>

      <section className="flex-1 grid place-items-center px-6 py-16">
        <div className="w-full max-w-md">
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-broadcast-red mb-3">
            ── Editorial sign-in
          </p>
          <h1 className="font-display italic text-4xl sm:text-5xl mb-2">Newsroom</h1>
          <p className="text-navy/70 mb-8">
            Sign in to publish, edit, or update the site. Bradley only.
          </p>

          <form onSubmit={onSubmit} className="space-y-5 bg-white rounded-md border border-navy/10 shadow-sm p-6">
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.2em] text-navy/70 mb-1.5" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-navy/20 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
                placeholder="you@bbsports.com"
              />
            </div>
            <div>
              <label className="block text-xs font-mono uppercase tracking-[0.2em] text-navy/70 mb-1.5" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-navy/20 rounded px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-broadcast-red/50"
              />
            </div>

            {error ? (
              <div className="text-sm text-broadcast-red bg-broadcast-red/5 border border-broadcast-red/30 rounded px-3 py-2">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center bg-broadcast-red text-bone uppercase tracking-[0.2em] text-sm font-bold py-3 rounded hover:bg-broadcast-red/90 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-xs text-navy/50 mt-6">
            Trouble signing in? Contact Brandon. No public registrations.
          </p>
        </div>
      </section>
    </main>
  );
}
