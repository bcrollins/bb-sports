/**
 * Client-only behavior for the newsroom login form. The surrounding page is
 * server-rendered so the admin door has reliable first-response HTML.
 */
'use client';

import { useState, type FormEvent } from 'react';

export default function LoginForm({ nextPath }: { nextPath: string }) {
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
        credentials: 'same-origin',
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 429) {
          setError(data?.error ?? 'Too many attempts. Wait a few minutes and try again.');
        } else if (res.status === 503) {
          setError(data?.error ?? 'Newsroom is temporarily unavailable. Try again in a moment.');
        } else {
          setError(data?.error ?? 'Invalid email or password');
        }
        return;
      }
      // Hard navigation so the freshly set httpOnly cookie is on the next request.
      // Client router.push can race the cookie on some mobile browsers.
      window.location.assign(nextPath.startsWith('/admin') ? nextPath : '/admin');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
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
        {submitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
