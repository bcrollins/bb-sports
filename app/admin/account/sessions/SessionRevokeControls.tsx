'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Props =
  | { mode?: 'one'; sessionId: string; isCurrent: boolean; label: string }
  | { mode: 'others'; sessionId?: never; isCurrent?: never; label?: never };

export function SessionRevokeControls(props: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const isOthers = props.mode === 'others';

  async function run() {
    const confirmText = isOthers
      ? 'Revoke every other active newsroom session? This device stays signed in.'
      : props.isCurrent
        ? 'Revoke this device and sign out now?'
        : `Revoke ${props.label}?`;
    if (!window.confirm(confirmText)) return;

    setBusy(true);
    setMessage('');
    try {
      const res = await fetch('/api/admin/sessions/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isOthers ? { scope: 'others' } : { scope: 'one', sessionId: props.sessionId },
        ),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        error?: string;
        revokedCurrent?: boolean;
        redirectTo?: string;
      };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Could not revoke session.');
      }
      if (json.revokedCurrent || json.redirectTo) {
        window.location.href = json.redirectTo || '/admin/login';
        return;
      }
      setMessage(isOthers ? 'Other sessions revoked.' : 'Session revoked.');
      router.refresh();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Revoke failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <button
        type="button"
        onClick={() => void run()}
        disabled={busy}
        className={`inline-flex min-h-[44px] items-center justify-center rounded-sm border px-4 text-[11px] font-black uppercase tracking-[0.16em] disabled:opacity-60 ${
          isOthers
            ? 'border-navy bg-navy text-bone hover:bg-navy/90'
            : 'border-breaking/40 bg-breaking/10 text-breaking hover:bg-breaking/15'
        }`}
      >
        {busy ? 'Working…' : isOthers ? 'Revoke other devices' : 'Revoke'}
      </button>
      {message ? (
        <p className="max-w-xs text-right text-xs text-charcoal/70" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
