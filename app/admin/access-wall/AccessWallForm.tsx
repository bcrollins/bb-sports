'use client';

import { useState, type FormEvent } from 'react';

export default function AccessWallForm({ mode, updatedAt }: { mode: string; updatedAt: string | null }) {
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch('/api/admin/access-wall', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? 'Could not update access wall.');
        return;
      }
      setPassword('');
      setMessage('Access wall password updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-navy/10 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-navy/10 pb-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-navy">White access wall</h2>
          <p className="mt-1 text-sm text-navy/65">
            Mode: {mode}. {updatedAt ? `Last updated ${new Date(updatedAt).toLocaleString()}.` : 'Using the default launch password.'}
          </p>
        </div>
        <span className="rounded-full bg-navy/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-navy/70">
          Active
        </span>
      </div>

      <form onSubmit={onSubmit} className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto]">
        <label className="block">
          <span className="block text-[11px] font-mono uppercase tracking-[0.18em] text-navy/60 mb-1">
            New wall password
          </span>
          <input
            type="password"
            minLength={12}
            maxLength={128}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded border border-navy/20 bg-bone-50 px-3 text-sm outline-none focus:ring-2 focus:ring-broadcast-red/30"
            placeholder="calebwilliamsMVP"
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="self-end inline-flex h-11 items-center justify-center rounded bg-navy px-5 text-xs font-black uppercase tracking-[0.18em] text-bone hover:bg-navy/90 disabled:opacity-60"
        >
          {saving ? 'Saving' : 'Update wall'}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm text-navy">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-broadcast-red">{error}</p> : null}
    </section>
  );
}
